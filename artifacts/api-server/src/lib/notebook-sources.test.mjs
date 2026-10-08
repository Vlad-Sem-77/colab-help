import assert from "node:assert/strict";
import test from "node:test";
import { extractNotebookSourceIndexes } from "./notebook-sources.ts";

test("returns unique zero-based source indexes only for notebook cells in the supplied context", () => {
  const context = [
    "[Ячейка 1 · markdown]\nОписание проекта",
    "[Ячейка 2 · code]\nprint('result')",
  ].join("\n\n");

  assert.deepEqual(
    extractNotebookSourceIndexes(
      context,
      "Результат получен во второй ячейке [Ячейка 2]. Она же выводит значение [Ячейка 2]. [Ячейка 99]",
    ),
    [1],
  );
});

test("ignores source-like text inside cell bodies and returns no sources without citations", () => {
  const context = "[Ячейка 1 · code]\nprint('[Ячейка 2 · code]')";

  assert.deepEqual(extractNotebookSourceIndexes(context, "Текстовый ответ без ссылок."), []);
  assert.deepEqual(extractNotebookSourceIndexes(context, "См. [Ячейка 2]."), []);
});
