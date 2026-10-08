import type { Notebook } from "./notebook.ts";

const DEFAULT_MAX_LENGTH = 32_000;
const DEFAULT_CELL_CONTEXT_MAX_LENGTH = 10_000;
const TRUNCATION_MARKER = "\n[Контекст сокращён: часть содержимого не отправлена.]";
const TEXT_MIME_TYPES = ["text/plain", "text/markdown", "application/json"] as const;
const PYTHON_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
  "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while",
  "with", "yield", "true", "false", "none", "self", "print",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) {
    return value.join("");
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isRecord(value)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

function savedOutputText(output: unknown): string {
  if (!isRecord(output)) return "";

  if (output.output_type === "stream") {
    return toText(output.text);
  }

  if (output.output_type === "error") {
    const traceback = Array.isArray(output.traceback)
      ? output.traceback.filter((line): line is string => typeof line === "string").join("\n")
      : "";
    const message = [output.ename, output.evalue]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(": ");
    return traceback || message;
  }

  if (!isRecord(output.data)) return "";

  for (const mimeType of TEXT_MIME_TYPES) {
    const text = toText(output.data[mimeType]);
    if (text) return text;
  }

  return "";
}

function safePrefix(value: string, length: number): string {
  const prefix = value.slice(0, length);
  const lastCodeUnit = prefix.charCodeAt(prefix.length - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
    return prefix.slice(0, -1);
  }
  return prefix;
}

function getCellSource(cell: Notebook["cells"][number]): string {
  return cell.source.filter((line): line is string => typeof line === "string").join("");
}

function formatNotebookCell(
  notebook: Notebook,
  cellResults: Record<string, unknown>,
  index: number,
): string {
  const cell = notebook.cells[index];
  const source = getCellSource(cell);
  const details = [`[Ячейка ${index + 1} · ${cell.type}]`];

  if (source.trim()) details.push(`Содержимое:\n${source}`);

  cell.outputs.forEach((output, outputIndex) => {
    const text = savedOutputText(output);
    if (text.trim()) details.push(`Сохранённый результат ${outputIndex + 1}:\n${text}`);
  });

  const executedResult = toText(cellResults[cell.id]);
  if (executedResult.trim()) details.push(`Текущий результат выполнения:\n${executedResult}`);

  return details.join("\n\n");
}

function identifiersIn(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)]
      .map((match) => match[0])
      .filter((identifier) => !PYTHON_KEYWORDS.has(identifier.toLowerCase())),
  );
}

function importsIn(source: string): Set<string> {
  const imports = new Set<string>();
  for (const line of source.split(/\r?\n/)) {
    const fromImport = line.match(/^\s*from\s+[\w.]+\s+import\s+(.+?)(?:\s+#.*)?$/);
    const directImport = line.match(/^\s*import\s+(.+?)(?:\s+#.*)?$/);
    const isFromImport = Boolean(fromImport);
    const importList = fromImport?.[1] ?? directImport?.[1];
    if (!importList) continue;

    for (const item of importList.replace(/[()]/g, "").split(",")) {
      const [name, alias] = item.trim().split(/\s+as\s+/);
      const binding = alias?.trim()
        || (isFromImport ? name?.trim() : name?.trim().split(".")[0]);
      if (binding && /^[A-Za-z_]\w*$/.test(binding) && !PYTHON_KEYWORDS.has(binding.toLowerCase())) {
        imports.add(binding);
      }
    }
  }
  return imports;
}

function scoreSharedIdentifiers(
  candidateIdentifiers: ReadonlySet<string>,
  targetIdentifiers: ReadonlySet<string>,
): number {
  let score = 0;
  for (const identifier of targetIdentifiers) {
    if (candidateIdentifiers.has(identifier)) score += identifier.length >= 8 ? 2 : 1;
  }
  return score;
}

function relevantCellIndexes(notebook: Notebook, targetIndex: number): number[] {
  const sources = notebook.cells.map(getCellSource);
  const identifiersByCell = sources.map(identifiersIn);
  const importsByCell = sources.map(importsIn);
  const target = notebook.cells[targetIndex];
  const selected = new Set<number>([targetIndex]);
  const targetImports = importsByCell[targetIndex];
  const targetIdentifiers = identifiersByCell[targetIndex];

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    if (notebook.cells[index].type === "markdown") {
      selected.add(index);
      break;
    }
  }

  if (target.type === "markdown") {
    const nextCodeIndex = notebook.cells.findIndex(
      (cell, index) => index > targetIndex && (cell.type === "code" || cell.type === "parameter"),
    );
    if (nextCodeIndex >= 0) selected.add(nextCodeIndex);
    return [...selected].sort((left, right) => left - right);
  }

  const importMatches = notebook.cells
    .map((_, index) => {
      const cellImports = importsByCell[index];
      const score = [...cellImports].filter((binding) => targetIdentifiers.has(binding)).length;
      return { index, score, isImportCell: cellImports.size > 0 };
    })
    .filter((candidate) => candidate.isImportCell && candidate.score > 0)
    .sort((left, right) => right.score - left.score || Math.abs(left.index - targetIndex) - Math.abs(right.index - targetIndex))
    .slice(0, 2);
  for (const candidate of importMatches) selected.add(candidate.index);

  const usageIdentifiers = targetImports.size > 0
    ? targetImports
    : new Set([...targetIdentifiers].filter((identifier) => identifier.length >= 4));
  const relatedCode = notebook.cells
    .map((cell, index) => {
      const score = index === targetIndex
        ? 0
        : scoreSharedIdentifiers(identifiersByCell[index], usageIdentifiers);
      return { index, score, type: cell.type };
    })
    .filter(({ index, score, type }) => (
      index !== targetIndex
      && (type === "code" || type === "parameter")
      && score > 0
      && (targetImports.size > 0 || score >= 2)
    ))
    .sort((left, right) => right.score - left.score || Math.abs(left.index - targetIndex) - Math.abs(right.index - targetIndex))
    .slice(0, targetImports.size > 0 ? 3 : 2);
  for (const candidate of relatedCode) selected.add(candidate.index);

  if (selected.size === 1) {
    const adjacentIndex = targetIndex > 0 ? targetIndex - 1 : targetIndex + 1;
    if (notebook.cells[adjacentIndex]) selected.add(adjacentIndex);
  }

  return [...selected].sort((left, right) => left - right);
}

export function buildNotebookContext(
  notebook: Notebook,
  cellResults: Record<string, unknown> = {},
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : DEFAULT_MAX_LENGTH;
  if (limit === 0) return "";

  const sections = notebook.cells.map((_, index) => formatNotebookCell(notebook, cellResults, index));

  const context = sections.join("\n\n").trim()
    || "Блокнот не содержит текстовых ячеек и сохранённых текстовых результатов.";
  if (context.length <= limit) return context;

  if (limit <= TRUNCATION_MARKER.length) {
    return safePrefix(context, limit);
  }

  return `${safePrefix(context, limit - TRUNCATION_MARKER.length).trimEnd()}${TRUNCATION_MARKER}`;
}

export function buildNotebookCellContext(
  notebook: Notebook,
  cellResults: Record<string, unknown>,
  targetCellIndex: number,
  maxLength = DEFAULT_CELL_CONTEXT_MAX_LENGTH,
): string {
  if (
    !Number.isInteger(targetCellIndex)
    || targetCellIndex < 0
    || targetCellIndex >= notebook.cells.length
    || !Number.isFinite(maxLength)
    || maxLength <= 0
  ) {
    return "";
  }

  const limit = Math.max(1, Math.floor(maxLength));
  const indexes = relevantCellIndexes(notebook, targetCellIndex);
  const targetSection = formatNotebookCell(notebook, cellResults, targetCellIndex);
  if (targetSection.length >= limit) {
    if (limit <= TRUNCATION_MARKER.length) return safePrefix(targetSection, limit);
    return `${safePrefix(targetSection, limit - TRUNCATION_MARKER.length).trimEnd()}${TRUNCATION_MARKER}`;
  }

  const sections = new Map<number, string>([[targetCellIndex, targetSection]]);
  let remaining = limit - targetSection.length;
  let omittedContext = false;
  for (const index of indexes) {
    if (index === targetCellIndex) continue;
    const section = formatNotebookCell(notebook, cellResults, index);
    const separatorLength = sections.size > 0 ? 2 : 0;
    if (section.length + separatorLength > remaining) {
      omittedContext = true;
      continue;
    }
    sections.set(index, section);
    remaining -= section.length + separatorLength;
  }

  const context = [...sections.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, section]) => section)
    .join("\n\n");
  const note = omittedContext ? "\n\n[Часть связанного контекста не отправлена.]" : "";
  const result = `${context}${note}`;
  return result.length <= limit ? result : safePrefix(result, limit);
}
