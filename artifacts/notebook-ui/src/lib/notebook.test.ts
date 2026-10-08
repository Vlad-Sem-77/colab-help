import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exportNotebook, parseNotebook } from "./notebook.ts";
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
