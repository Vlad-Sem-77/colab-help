import test from "node:test";
import assert from "node:assert/strict";
import { parseAiNotebookCellExplanations } from "./notebook-cell-explanations.ts";

const context = [
  "[Ячейка 1 · markdown]\nСодержимое:\n# Введение",
  "[Ячейка 2 · code]\nСодержимое:\nimport pandas as pd",
].join("\n\n");

test("parses JSON explanations and converts one-based cell numbers to zero-based indexes", () => {
  const explanations = parseAiNotebookCellExplanations(context, JSON.stringify({
    explanations: [
      { cellNumber: 2, explanation: "Подключает pandas для чтения таблиц." },
      { cellNumber: 1, explanation: "Обозначает вводный раздел." },
    ],
  }));

  assert.deepEqual(explanations, [
    { cellIndex: 0, explanation: "Обозначает вводный раздел." },
    { cellIndex: 1, explanation: "Подключает pandas для чтения таблиц." },
  ]);
});

test("accepts fenced JSON and ignores references to cells absent from the submitted context", () => {
  const explanations = parseAiNotebookCellExplanations(
    context,
    '```json\n{"explanations":[{"cellNumber":1,"explanation":" Вводный раздел. "},{"cellNumber":9,"explanation":"Не отправленная ячейка."}]}\n```',
  );

  assert.deepEqual(explanations, [
    { cellIndex: 0, explanation: "Вводный раздел." },
  ]);
});

test("drops duplicate, empty, overlong, and malformed explanations", () => {
  const explanations = parseAiNotebookCellExplanations(context, JSON.stringify({
    explanations: [
      { cellNumber: 1, explanation: "Первое пояснение." },
      { cellNumber: 1, explanation: "Дубликат." },
      { cellNumber: 2, explanation: " " },
      { cellNumber: 2, explanation: "x".repeat(1601) },
      null,
    ],
  }));

  assert.deepEqual(explanations, [
    { cellIndex: 0, explanation: "Первое пояснение." },
  ]);
});

test("rejects invalid model output", () => {
  assert.deepEqual(parseAiNotebookCellExplanations(context, "not JSON"), []);
  assert.deepEqual(parseAiNotebookCellExplanations(context, '{"answer":"not a list"}'), []);
});
