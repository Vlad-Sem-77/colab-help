export interface AiNotebookCellExplanation {
  cellIndex: number;
  explanation: string;
}

const MAX_EXPLANATIONS = 500;
const MAX_EXPLANATION_LENGTH = 1600;

export function parseAiNotebookCellExplanations(
  notebookContext: string,
  modelOutput: string,
): AiNotebookCellExplanation[] {
  const availableCellNumbers = new Set(
    [...notebookContext.matchAll(/^\[Ячейка\s+(\d+)\s*·/gim)]
      .map((match) => Number(match[1]))
      .filter((number) => Number.isInteger(number) && number > 0),
  );
  if (availableCellNumbers.size === 0) return [];

  const fencedJson = modelOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidates = [fencedJson, modelOutput.trim()].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  let parsed: unknown;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // Try the next output form; malformed model output is rejected below.
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.explanations)) return [];

  const seen = new Set<number>();
  const explanations: AiNotebookCellExplanation[] = [];
  for (const candidate of record.explanations) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const item = candidate as Record<string, unknown>;
    const cellNumber = item.cellNumber;
    const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
    if (
      typeof cellNumber !== "number"
      || !Number.isInteger(cellNumber)
      || !availableCellNumbers.has(cellNumber)
      || seen.has(cellNumber)
      || !explanation
      || explanation.length > MAX_EXPLANATION_LENGTH
      || explanations.length >= MAX_EXPLANATIONS
    ) {
      continue;
    }

    seen.add(cellNumber);
    explanations.push({ cellIndex: cellNumber - 1, explanation });
  }

  return explanations.sort((left, right) => left.cellIndex - right.cellIndex);
}
