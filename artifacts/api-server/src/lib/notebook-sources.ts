export function extractNotebookSourceIndexes(notebookContext: string, answer: string): number[] {
  const availableCells = new Set(
    [...notebookContext.matchAll(/^\[Ячейка\s+(\d+)\s*·/gim)]
      .map((match) => Number(match[1]))
      .filter((cellNumber) => Number.isInteger(cellNumber) && cellNumber > 0),
  );

  return [...new Set(
    [...answer.matchAll(/\[Ячейка\s+(\d+)\]/gi)]
      .map((match) => Number(match[1]) - 1)
      .filter((cellIndex) => availableCells.has(cellIndex + 1)),
  )];
}
