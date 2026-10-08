import assert from "node:assert/strict";
import test from "node:test";
import { explainImportedLibraries, explainNotebookCell } from "./notebook-explanations.ts";
import { parseNotebook } from "./notebook.ts";

test("explains Markdown intent without repeating the imported prose", () => {
  const originalText = "Этот текст описывает подготовку данных.";
  const notebook = parseNotebook({
    cells: [{
      cell_type: "markdown",
      source: `# Анализ продаж\n\n${originalText}`,
    }],
  });

  const explanation = explainNotebookCell(notebook.cells[0], 0, notebook);

  assert.match(explanation, /подготовку входных данных/);
  assert.doesNotMatch(explanation, new RegExp(originalText));
});

test("explains code comments as intent instead of quoting them", () => {
  const comment = "# Load data before analysis";
  const notebook = parseNotebook({
    cells: [{ cell_type: "code", source: comment }],
  });

  const explanation = explainNotebookCell(notebook.cells[0], 0, notebook);

  assert.match(explanation, /этап получения или подготовки входных данных/);
  assert.doesNotMatch(explanation, /Load data before analysis/);
});

test("explains each imported library and its observed role in the notebook", () => {
  const notebook = parseNotebook({
    cells: [
      {
        cell_type: "code",
        source: [
          "import pandas as pd\n",
          "import numpy as np\n",
          "sales = pd.read_csv('sales.csv')\n",
          "sales = sales.dropna()\n",
          "average = np.mean(sales['amount'])\n",
        ],
      },
    ],
  });

  const explanations = explainImportedLibraries(notebook.cells[0], notebook);
  const pandas = explanations.find(item => item.name === "pandas");
  const numpy = explanations.find(item => item.name === "NumPy");

  assert.equal(explanations.length, 2);
  assert.match(pandas?.purpose ?? "", /табличными данными/);
  assert.match(pandas?.notebookUse ?? "", /загрузки исходной таблицы/);
  assert.match(numpy?.purpose ?? "", /числовые массивы/);
  assert.match(numpy?.notebookUse ?? "", /числовых массивах/);
});

test("does not invent the purpose of an imported package that is not used", () => {
  const notebook = parseNotebook({
    cells: [{ cell_type: "code", source: "import sample_pkg\n" }],
  });

  const explanation = explainImportedLibraries(notebook.cells[0], notebook)[0];

  assert.equal(explanation?.name, "sample_pkg");
  assert.match(explanation?.notebookUse ?? "", /явных обращений/);
});
