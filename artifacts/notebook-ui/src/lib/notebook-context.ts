import type { Notebook } from "./notebook.ts";

const DEFAULT_MAX_LENGTH = 32_000;
const TRUNCATION_MARKER = "\n[Контекст сокращён: часть содержимого не отправлена.]";
const TEXT_MIME_TYPES = ["text/plain", "text/markdown", "application/json"] as const;

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

export function buildNotebookContext(
  notebook: Notebook,
  cellResults: Record<string, unknown> = {},
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : DEFAULT_MAX_LENGTH;
  if (limit === 0) return "";

  const sections = notebook.cells.map((cell, index) => {
    const source = cell.source.filter((line): line is string => typeof line === "string").join("");
    const details = [`[Ячейка ${index + 1} · ${cell.type}]`];

    if (source.trim()) details.push(`Содержимое:\n${source}`);

    cell.outputs.forEach((output, outputIndex) => {
      const text = savedOutputText(output);
      if (text.trim()) details.push(`Сохранённый результат ${outputIndex + 1}:\n${text}`);
    });

    const executedResult = toText(cellResults[cell.id]);
    if (executedResult.trim()) details.push(`Текущий результат выполнения:\n${executedResult}`);

    return details.join("\n\n");
  });

  const context = sections.join("\n\n").trim()
    || "Блокнот не содержит текстовых ячеек и сохранённых текстовых результатов.";
  if (context.length <= limit) return context;

  if (limit <= TRUNCATION_MARKER.length) {
    return safePrefix(context, limit);
  }

  return `${safePrefix(context, limit - TRUNCATION_MARKER.length).trimEnd()}${TRUNCATION_MARKER}`;
}
