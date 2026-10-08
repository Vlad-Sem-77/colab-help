import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  analyzeNotebook,
  answerNotebookQuestion,
  canRunNotebookCell,
  clearSavedCellEnabledState,
  createNotebookSettingsId,
  createCellEnabledState,
  explainImportedLibraries,
  explainNotebookCell,
  exportNotebook,
  getRunnableNotebookCells,
  isCellEnabled,
  parseNotebook,
  readSavedCellEnabledState,
  saveCellEnabledState,
  setCellEnabled,
} from "./notebook.ts";
import { buildNotebookContext } from "./notebook-context.ts";

test("round-trips a standard notebook without dropping its metadata or saved outputs", () => {
  const original = {
    cells: [
      {
        cell_type: "markdown",
        id: "intro-cell",
        metadata: { tags: ["intro"], custom: { keep: true } },
        source: "# Notebook title\n",
      },
      {
        cell_type: "code",
        id: "executed-cell",
        execution_count: 6,
        metadata: { trusted: true, customCellValue: "keep me" },
        outputs: [
          { output_type: "stream", name: "stdout", text: ["saved ", "output\n"] },
          {
            output_type: "execute_result",
            execution_count: 6,
            data: { "text/plain": ["42"] },
            metadata: { customMimeMetadata: true },
          },
        ],
        source: ["print('saved output')\n"],
      },
    ],
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3" },
      language_info: { name: "python" },
      customNotebookValue: { keep: true },
    },
    nbformat: 4,
    nbformat_minor: 5,
    customRootValue: "keep me",
  };

  const exported = JSON.parse(exportNotebook(parseNotebook(original), {}));

  assert.deepEqual(exported, original);
});

test("round-trips the repository's Colab notebook metadata, cell IDs, counts, and outputs", () => {
  const original = JSON.parse(
    readFileSync(new URL("../../../../colab_backend.ipynb", import.meta.url), "utf8"),
  );
  original.cells.forEach((cell: any, index: number) => {
    cell.id = cell.id || `colab-cell-${index}`;
  });

  const executedCell = original.cells.find((cell: any) => cell.cell_type === "code");
  executedCell.execution_count = 12;
  executedCell.metadata = {
    ...executedCell.metadata,
    colab: { base_uri: "https://localhost:8080/", height: 100 },
    customCellMetadata: { retained: true },
  };
  executedCell.outputs = [
    {
      output_type: "execute_result",
      execution_count: 12,
      data: {
        "text/plain": ["Colab output"],
        "text/html": ["<b>Colab output</b>"],
      },
      metadata: { customMimeMetadata: "retained" },
    },
  ];

  const exported = JSON.parse(exportNotebook(parseNotebook(original), {}));

  assert.deepEqual(exported, original);
});

test("cell enablement is independent and does not change exported notebook content", () => {
  const original = {
    cells: [
      { cell_type: "markdown", id: "intro", source: "# Intro\n" },
      { cell_type: "code", id: "first-code", source: ["print('first')\n"], outputs: [] },
      { cell_type: "code", id: "second-code", source: ["print('second')\n"], outputs: [] },
      { cell_type: "code", id: "parameters", source: "temperature = 0.7\n", outputs: [] },
    ],
    metadata: { kernelspec: { name: "python3" } },
    nbformat: 4,
    nbformat_minor: 5,
  };
  const notebook = parseNotebook(original);
  const initialState = createCellEnabledState(notebook.cells);
  const disabledState = setCellEnabled(initialState, "first-code", false);

  assert.equal(isCellEnabled(disabledState, "first-code"), false);
  assert.equal(isCellEnabled(disabledState, "second-code"), true);
  assert.equal(isCellEnabled(initialState, "first-code"), true);
  assert.equal(canRunNotebookCell(notebook.cells[1], disabledState), false);
  assert.equal(canRunNotebookCell(notebook.cells[2], disabledState), true);
  assert.equal(notebook.cells[3].type, "parameter");
  assert.equal(canRunNotebookCell(notebook.cells[3], disabledState), true);
  assert.equal(
    canRunNotebookCell(notebook.cells[3], setCellEnabled(disabledState, "parameters", false)),
    false,
  );
  assert.equal(canRunNotebookCell(notebook.cells[0], disabledState), false);
  assert.deepEqual(notebook.cells.map(cell => cell.source), [
    ["# Intro\n"],
    ["print('first')\n"],
    ["print('second')\n"],
    ["temperature = 0.7\n"],
  ]);

  const reloadedState = createCellEnabledState(parseNotebook(original).cells);
  assert.ok(notebook.cells.every(cell => isCellEnabled(reloadedState, cell.id)));

  const exported = JSON.parse(exportNotebook(notebook, {}));
  assert.deepEqual(exported, original);
  assert.equal(JSON.stringify(exported).includes("first-code\":false"), false);
});

test("runnable cells preserve notebook order and exclude disabled and unsupported cells", () => {
  const notebook = parseNotebook({
    cells: [
      { cell_type: "markdown", id: "intro", source: "# Intro" },
      { cell_type: "code", id: "first", source: "print('first')" },
      { cell_type: "code", id: "parameters", source: "temperature = 0.7" },
      { cell_type: "raw", id: "raw", source: "raw content" },
      { cell_type: "code", id: "disabled", source: "print('disabled')" },
      { cell_type: "code", id: "last", source: "print('last')" },
    ],
  });
  const enabled = setCellEnabled(
    createCellEnabledState(notebook.cells),
    "disabled",
    false,
  );

  assert.deepEqual(
    getRunnableNotebookCells(notebook.cells, enabled).map(cell => cell.id),
    ["first", "parameters", "last"],
  );
});

test("cell enablement preferences are isolated by notebook, restored across loads, and resettable", async () => {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  const firstNotebook = parseNotebook({
    cells: [
      { cell_type: "code", id: "first", source: "print('first')" },
      { cell_type: "code", id: "second", source: "print('second')" },
    ],
  });
  const secondNotebook = parseNotebook({
    cells: [{ cell_type: "code", id: "first", source: "print('different')" }],
  });
  const firstId = await createNotebookSettingsId(firstNotebook);
  const secondId = await createNotebookSettingsId(secondNotebook);
  const firstState = setCellEnabled(createCellEnabledState(firstNotebook.cells), "first", false);

  assert.notEqual(firstId, secondId);
  assert.equal(saveCellEnabledState(localStorage, firstId, firstState), true);
  assert.deepEqual(
    readSavedCellEnabledState(localStorage, firstId, parseNotebook(firstNotebook.original).cells),
    firstState,
  );
  assert.deepEqual(
    readSavedCellEnabledState(localStorage, secondId, secondNotebook.cells),
    null,
  );
  assert.equal(clearSavedCellEnabledState(localStorage, firstId), true);
  assert.deepEqual(
    readSavedCellEnabledState(localStorage, firstId, firstNotebook.cells),
    null,
  );
});

test("notebook settings IDs do not depend on JSON object key order", async () => {
  const first = parseNotebook({
    metadata: { owner: "reader", language: "python" },
    cells: [{ cell_type: "code", id: "cell-1", source: "print(1)" }],
  });
  const reordered = parseNotebook({
    cells: [{ source: "print(1)", id: "cell-1", cell_type: "code" }],
    metadata: { language: "python", owner: "reader" },
  });

  assert.equal(
    await createNotebookSettingsId(first),
    await createNotebookSettingsId(reordered),
  );
});

test("summarizes notebook structure, headings, execution state, and errors", () => {
  const notebook = parseNotebook({
    metadata: {
      kernelspec: { language: "python", display_name: "Python 3" },
    },
    cells: [
      { cell_type: "markdown", source: "# Load data\n\nRead the input file." },
      { cell_type: "code", source: "import pandas as pd\n\ndata = pd.read_csv('input.csv')", execution_count: 1 },
      {
        cell_type: "code",
        source: "model.fit(data)",
        outputs: [{ output_type: "error", ename: "ValueError", evalue: "bad input" }],
      },
    ],
  });

  const analysis = analyzeNotebook(notebook);

  assert.equal(analysis.totalCells, 3);
  assert.equal(analysis.markdownCells, 1);
  assert.equal(analysis.codeCells, 2);
  assert.equal(analysis.executedCells, 1);
  assert.equal(analysis.outputCells, 1);
  assert.equal(analysis.errorCount, 1);
  assert.equal(analysis.language, "python");
  assert.deepEqual(analysis.sections, ["Load data"]);
  assert.match(analysis.summary, /Load data/);
  assert.match(analysis.summary, /ошибок: 1/);
  const libraryExplanations = explainImportedLibraries(notebook.cells[1], notebook);
  assert.equal(libraryExplanations[0]?.name, "pandas");
  assert.match(libraryExplanations[0]?.purpose ?? "", /табличными данными/);
  assert.match(libraryExplanations[0]?.notebookUse ?? "", /загрузки исходных файлов/);
});

test("answers questions with relevant notebook cells and saved outputs", () => {
  const notebook = parseNotebook({
    cells: [
      { cell_type: "markdown", source: "# Preparation\nClean the source data first." },
      {
        cell_type: "code",
        source: "import pandas as pd\ndata = pd.read_csv('sales.csv')",
        outputs: [{ output_type: "stream", text: "Loaded 12 rows" }],
      },
      { cell_type: "code", source: "print(data.shape)" },
    ],
  });

  const libraryAnswer = answerNotebookQuestion(notebook, "Какие библиотеки использует ноутбук?");
  assert.deepEqual(libraryAnswer.sources, [1]);
  assert.match(libraryAnswer.text, /pandas/);
  assert.match(libraryAnswer.text, /Loaded 12 rows/);

  const cellAnswer = answerNotebookQuestion(notebook, "Что происходит в ячейке 1?");
  assert.deepEqual(cellAnswer.sources, [0]);
  assert.match(cellAnswer.text, /подготовку входных данных/);
  assert.doesNotMatch(cellAnswer.text, /Clean the source data first/);

  const structureAnswer = answerNotebookQuestion(notebook, "Какова структура ноутбука?");
  assert.equal(structureAnswer.sources.length, 0);
  assert.match(structureAnswer.text, /3 ячеек/);

  const noMatchAnswer = answerNotebookQuestion(notebook, "Что такое квантовая гравитация?");
  assert.deepEqual(noMatchAnswer.sources, []);
  assert.match(noMatchAnswer.text, /Не нашёл/);
});

test("builds assistant context from cell source and readable saved output only", () => {
  const notebook = parseNotebook({
    cells: [
      {
        cell_type: "markdown",
        source: ["# Цель\n", "Обучить классификатор."],
        outputs: [],
      },
      {
        cell_type: "code",
        id: "training",
        source: ["model.fit(data)\n"],
        outputs: [
          { output_type: "stream", text: ["Обучение завершено\n"] },
          {
            output_type: "execute_result",
            data: {
              "text/plain": ["accuracy = 0.94"],
              "text/html": ["<table><tr><td>private html</td></tr></table>"],
              "image/png": "cHJpdmF0ZSBpbWFnZQ==",
            },
          },
        ],
      },
    ],
  });

  const context = buildNotebookContext(notebook, { training: "Текущая точность: 0.95" });

  assert.match(context, /Обучить классификатор/);
  assert.match(context, /model\.fit\(data\)/);
  assert.match(context, /Обучение завершено/);
  assert.match(context, /accuracy = 0\.94/);
  assert.match(context, /Текущая точность: 0\.95/);
  assert.doesNotMatch(context, /private html|cHJpdmF0ZSBpbWFnZQ==/);
});

test("caps notebook context and marks when content was omitted", () => {
  const notebook = parseNotebook({
    cells: [{ cell_type: "code", source: ["🙂".repeat(100)], outputs: [] }],
  });

  const context = buildNotebookContext(notebook, {}, 80);

  assert.ok(context.length <= 80);
  assert.match(context, /Контекст сокращён/);
  assert.equal(/[\uD800-\uDBFF]$/.test(context), false);
});

test("returns a readable note for notebooks without cells", () => {
  assert.match(buildNotebookContext(parseNotebook({ cells: [] })), /не содержит текстовых ячеек/);
});

test("rejects JSON that does not have the structure of a notebook", () => {
  assert.throws(() => parseNotebook({ title: "not a notebook" }), /массивом cells/);
  assert.throws(
    () => parseNotebook({ cells: [{ cell_type: "code", source: ["ok"], outputs: {} }] }),
    /outputs должно быть массивом/,
  );
});

test("preserves raw notebook cells as readable text", () => {
  const notebook = parseNotebook({
    cells: [{ cell_type: "raw", source: "Raw cell contents", outputs: [] }],
  });

  assert.equal(notebook.cells[0].type, "raw");
  assert.match(buildNotebookContext(notebook), /Raw cell contents/);
});
