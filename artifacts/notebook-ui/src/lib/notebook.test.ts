import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exportNotebook, parseNotebook } from "./notebook.ts";

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
