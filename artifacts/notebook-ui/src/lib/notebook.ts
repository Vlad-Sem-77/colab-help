export type CellType = 'markdown' | 'code' | 'parameter' | 'raw';

export interface ParamInfo {
  varName: string;
  varType: 'string' | 'float' | 'int' | 'bool';
  defaultValue: any;
}

export interface NotebookCell {
  id: string;
  type: CellType;
  source: string[];
  outputs: any[];
  execution_count?: number | null;
  metadata?: Record<string, any>;
  params?: ParamInfo[];
  original?: Record<string, any>;
}

export type CellEnabledState = Record<string, boolean>;

type CellEnabledStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sortObjectKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortObjectKeys(value[key])]),
  );
}

export async function createNotebookSettingsId(notebook: Notebook): Promise<string> {
  const canonicalNotebook = JSON.stringify(sortObjectKeys(notebook.original ?? notebook));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalNotebook),
  );

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function cellEnabledStorageKey(notebookId: string): string {
  return `notebook-ui-cell-settings:v1:${notebookId}`;
}

export interface Notebook {
  cells: NotebookCell[];
  metadata?: Record<string, any>;
  nbformat?: number;
  nbformat_minor?: number;
  original?: Record<string, any>;
}

export function createCellEnabledState(cells: readonly Pick<NotebookCell, "id">[]): CellEnabledState {
  return Object.fromEntries(cells.map(cell => [cell.id, true]));
}

export function readSavedCellEnabledState(
  storage: CellEnabledStorage,
  notebookId: string,
  cells: readonly Pick<NotebookCell, "id">[],
): CellEnabledState | null {
  try {
    const saved = JSON.parse(storage.getItem(cellEnabledStorageKey(notebookId)) ?? "null");
    if (!saved || saved.version !== 1 || !saved.enabled || typeof saved.enabled !== "object") {
      return null;
    }

    const state = createCellEnabledState(cells);
    for (const cell of cells) {
      if (typeof saved.enabled[cell.id] === "boolean") {
        state[cell.id] = saved.enabled[cell.id];
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function saveCellEnabledState(
  storage: CellEnabledStorage,
  notebookId: string,
  state: CellEnabledState,
): boolean {
  try {
    storage.setItem(cellEnabledStorageKey(notebookId), JSON.stringify({ version: 1, enabled: state }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedCellEnabledState(storage: CellEnabledStorage, notebookId: string): boolean {
  try {
    storage.removeItem(cellEnabledStorageKey(notebookId));
    return true;
  } catch {
    return false;
  }
}

export function isCellEnabled(state: CellEnabledState, cellId: string): boolean {
  return state[cellId] !== false;
}

export function setCellEnabled(
  state: CellEnabledState,
  cellId: string,
  enabled: boolean,
): CellEnabledState {
  return { ...state, [cellId]: enabled };
}

export function canRunNotebookCell(cell: NotebookCell, state: CellEnabledState): boolean {
  return isCellEnabled(state, cell.id) && (cell.type === "code" || cell.type === "parameter");
}

export interface NotebookAnalysis {
  totalCells: number;
  markdownCells: number;
  codeCells: number;
  parameterCells: number;
  executedCells: number;
  outputCells: number;
  errorCount: number;
  language: string | null;
  sections: string[];
  summary: string;
}
export function parseNotebook(json: any): Notebook {
  if (!json || typeof json !== 'object' || Array.isArray(json) || !Array.isArray(json.cells)) {
    throw new Error("Файл не похож на Jupyter/Colab-блокнот: ожидался объект с массивом cells.");
  }

  const parsedCells = json.cells.map((c: any, i: number) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new Error(`Ячейка ${i + 1} должна быть JSON-объектом.`);
    }
    if (!['markdown', 'code', 'raw'].includes(c.cell_type)) {
      throw new Error(`У ячейки ${i + 1} неизвестный тип: ${String(c.cell_type)}.`);
    }

    const id = c.id || `cell-${i}`;
    const sourceArray = typeof c.source === 'string'
      ? [c.source]
      : Array.isArray(c.source) && c.source.every((line: unknown) => typeof line === 'string')
        ? c.source
        : null;
    if (!sourceArray) {
      throw new Error(`У ячейки ${i + 1} поле source должно содержать текст.`);
    }

    const outputs = c.outputs === undefined ? [] : c.outputs;
    if (!Array.isArray(outputs)) {
      throw new Error(`У ячейки ${i + 1} поле outputs должно быть массивом.`);
    }

    const commonFields = {
      id,
      source: sourceArray,
      outputs,
      execution_count: c.execution_count,
      metadata: c.metadata,
      original: c,
    };

    if (c.cell_type === 'markdown') {
      return { ...commonFields, type: 'markdown' };
    } else if (c.cell_type === 'code') {
      const params = detectParams(sourceArray);
      if (params.length > 0) {
        return { ...commonFields, type: 'parameter', params };
      } else {
        return { ...commonFields, type: 'code' };
      }
    }
    return { ...commonFields, type: 'raw' };
  });

  return {
    cells: parsedCells,
    metadata: json.metadata,
    nbformat: json.nbformat,
    nbformat_minor: json.nbformat_minor,
    original: json,
  };
}

function cellSource(cell: NotebookCell): string {
  return cell.source.join("");
}
function detectParams(sourceLines: string[]): ParamInfo[] {
  const params: ParamInfo[] = [];
  
  // Basic patterns matching parameter cell criteria
  const stringRegex = /^(\w+)\s*=\s*["'](.+)["']/;
  const floatRegex = /^(\w+)\s*=\s*(\d+\.\d+)/;
  const intRegex = /^(\w+)\s*=\s*(\d+)/;
  const boolRegex = /^(\w+)\s*=\s*(True|False)/;
  
  for (const line of sourceLines) {
    const trimmed = line.trim();
    if (stringRegex.test(trimmed)) {
      const [, varName, defaultValue] = trimmed.match(stringRegex)!;
      params.push({ varName, varType: 'string', defaultValue });
    } else if (floatRegex.test(trimmed)) {
      const [, varName, defaultValue] = trimmed.match(floatRegex)!;
      params.push({ varName, varType: 'float', defaultValue: parseFloat(defaultValue) });
    } else if (intRegex.test(trimmed)) {
      const [, varName, defaultValue] = trimmed.match(intRegex)!;
      params.push({ varName, varType: 'int', defaultValue: parseInt(defaultValue, 10) });
    } else if (boolRegex.test(trimmed)) {
      const [, varName, defaultValue] = trimmed.match(boolRegex)!;
      params.push({ varName, varType: 'bool', defaultValue: defaultValue === 'True' });
    }
  }
  return params;
}

export function exportNotebook(notebook: Notebook, cellValues: Record<string, Record<string, any>>): string {
  const originalNotebook = notebook.original || {};
  const exportData = {
    ...originalNotebook,
    cells: notebook.cells.map(c => {
      let source = [...c.source];
      if (c.type === 'parameter' && cellValues[c.id]) {
        const values = cellValues[c.id];
        source = source.map(line => {
          let updatedLine = line;
          for (const param of c.params || []) {
            if (values[param.varName] !== undefined) {
              const val = values[param.varName];
              const stringRegex = new RegExp(`^(${param.varName})\\s*=\\s*["'].+["']`);
              const numRegex = new RegExp(`^(${param.varName})\\s*=\\s*\\d+(?:\\.\\d+)?`);
              const boolRegex = new RegExp(`^(${param.varName})\\s*=\\s*(?:True|False)`);

              if (param.varType === 'string') {
                updatedLine = updatedLine.replace(stringRegex, `$1 = "${val}"`);
              } else if (param.varType === 'bool') {
                updatedLine = updatedLine.replace(boolRegex, `$1 = ${val ? 'True' : 'False'}`);
              } else {
                updatedLine = updatedLine.replace(numRegex, `$1 = ${val}`);
              }
            }
          }
          return updatedLine;
        });
      }

      const originalSource = c.original?.source;
      const sourceIsUnchanged =
        JSON.stringify(source) === JSON.stringify(c.source);

      const exportedCell = {
        ...c.original,
        id: c.id,
        cell_type: c.type === 'parameter' ? 'code' : c.type,
        source: sourceIsUnchanged && originalSource !== undefined ? originalSource : source,
        execution_count: c.execution_count !== undefined
          ? c.execution_count
          : c.original?.execution_count,
        metadata: c.metadata !== undefined ? c.metadata : c.original?.metadata,
      };

      if (!c.original || Object.prototype.hasOwnProperty.call(c.original, 'outputs') || c.outputs.length > 0) {
        return { ...exportedCell, outputs: c.outputs };
      }
      return exportedCell;
    }),
    metadata: notebook.metadata !== undefined ? notebook.metadata : originalNotebook.metadata ?? {},
    nbformat: notebook.nbformat ?? originalNotebook.nbformat ?? 4,
    nbformat_minor: notebook.nbformat_minor ?? originalNotebook.nbformat_minor ?? 4,
  };

  return JSON.stringify(exportData, null, 2);
}

export function explainNotebookCell(cell: NotebookCell, index: number): string {
  const source = cellSource(cell).trim();
  if (!source) {
    return `Ячейка ${index + 1} пока пустая.`;
  }
  if (cell.type === "markdown") {
    const title = source.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const text = markdownText(source).replace(/\s+/g, " ");
    const preview = text.length > 180 ? `${text.slice(0, 177)}…` : text;
    return title
      ? `Раздел «${title}». ${preview}`
      : `Текстовое пояснение: ${preview}`;
  }

  const actions = codeActions(source);
  const params = cell.params?.map(param => param.varName) ?? [];
  if (cell.type === "parameter" && params.length > 0) {
    return `Ячейка с настраиваемыми параметрами: ${params.join(", ")}.${actions.length ? ` Также ${actions.join(" и ")}.` : ""}`;
  }
  if (actions.length > 0) {
    return `По коду видно, что ячейка ${actions.join("; ")}.`;
  }
  return "Выполняет код Python. Описание выведено по содержимому ячейки; проверьте код и сохранённый результат ниже.";
}

function outputSource(output: any): string {
  if (output?.output_type === "stream") {
    return Array.isArray(output.text) ? output.text.join("") : String(output.text ?? "");
  }
  if (output?.output_type === "error") {
    return [output.ename, output.evalue].filter(Boolean).join(": ");
  }
  const data = output?.data;
  if (data && typeof data === "object") {
    const mime = ["text/plain", "text/markdown", "application/json"]
      .find(type => data[type] !== undefined);
    if (mime) {
      const value = data[mime];
      return Array.isArray(value) ? value.join("") : String(value);
    }
  }
  return "";
}

function codeActions(source: string): string[] {
  const actions: string[] = [];
  const imports = [...source.matchAll(/^\s*(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/gm)]
    .map(match => match[1] || match[2])
    .filter(Boolean);
  if (imports.length > 0) {
    actions.push(`подключает библиотеки ${[...new Set(imports)].slice(0, 4).join(", ")}`);
  }
  if (/\b(read_csv|read_excel|read_json|read_parquet|read_sql|load_dataset|open)\s*\(/i.test(source)) {
    actions.push("загружает данные или файл");
  }
  if (/\b(def|class)\s+\w+/m.test(source)) {
    actions.push("определяет функцию или класс");
  }
  if (/\b(fit|train|backward|optimizer|Trainer)\s*\(?/i.test(source)) {
    actions.push("обучает или настраивает модель");
  }
  if (/\b(plt\.|sns\.|plotly|\.plot\s*\()/i.test(source)) {
    actions.push("строит визуализацию");
  }
  if (/\b(print|display)\s*\(/i.test(source)) {
    actions.push("выводит текст или данные");
  }
  if (/\b(groupby|pivot_table|merge|concat|dropna|fillna|astype)\s*\(/i.test(source)) {
    actions.push("обрабатывает таблицу или набор данных");
  }
  return [...new Set(actions)];
}

export function analyzeNotebook(notebook: Notebook): NotebookAnalysis {
  const markdownCells = notebook.cells.filter(cell => cell.type === "markdown").length;
  const parameterCells = notebook.cells.filter(cell => cell.type === "parameter").length;
  const codeCells = notebook.cells.filter(cell => cell.type === "code").length;
  const executedCells = notebook.cells.filter(cell => cell.execution_count != null).length;
  const outputCells = notebook.cells.filter(cell => cell.outputs.length > 0).length;
  const errorCount = notebook.cells.reduce(
    (count, cell) => count + cell.outputs.filter(output => output?.output_type === "error").length,
    0,
  );
  const sections = notebook.cells.flatMap(cell => {
    if (cell.type !== "markdown") return [];
    return [...cellSource(cell).matchAll(/^\s{0,3}#{1,6}\s+(.+)$/gm)]
      .map(match => match[1].trim())
      .filter(Boolean);
  });
  const kernelspec = notebook.metadata?.kernelspec;
  const language = notebook.metadata?.language_info?.name
    || kernelspec?.language
    || (kernelspec?.display_name ? String(kernelspec.display_name).replace(/\s*\d.*$/, "") : null)
    || null;

  const actions = [...new Set(notebook.cells
    .filter(cell => cell.type !== "markdown")
    .flatMap(cell => codeActions(cellSource(cell))))].slice(0, 3);
  const parts = [
    `Ноутбук содержит ${notebook.cells.length} ячеек: ${codeCells + parameterCells} с кодом и параметрами, ${markdownCells} текстовых.`,
    language ? `Язык ядра: ${language}.` : "",
    sections.length ? `Разделы: ${sections.slice(0, 5).join(" → ")}${sections.length > 5 ? " и другие" : ""}.` : "",
    actions.length ? `По коду видно, что ноутбук ${actions.join(", а также ")}.` : "",
    errorCount > 0 ? `В сохранённых результатах найдено ошибок: ${errorCount}.` : "",
  ].filter(Boolean);

  return {
    totalCells: notebook.cells.length,
    markdownCells,
    codeCells,
    parameterCells,
    executedCells,
    outputCells,
    errorCount,
    language,
    sections,
    summary: parts.join(" "),
  };
}

export interface NotebookAnswer {
  text: string;
  sources: number[];
}

const QUESTION_STOP_WORDS = new Set([
  "что", "как", "где", "когда", "почему", "зачем", "какой", "какая", "какие", "это",
  "есть", "для", "или", "при", "про", "мне", "можно", "ли", "в", "на", "и", "а", "но",
  "the", "what", "how", "where", "when", "why", "which", "does", "this", "that", "with",
  "from", "into", "are", "is", "and", "for",
]);

export function answerNotebookQuestion(notebook: Notebook, question: string): NotebookAnswer {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) {
    return { text: "Напишите вопрос о содержимом ноутбука.", sources: [] };
  }

  const analysis = analyzeNotebook(notebook);
  if (/(структур|резюм|кратк|цель|содержит|делает ноутбук|обзор)/i.test(normalizedQuestion)) {
    const sectionList = analysis.sections.length
      ? `\n\nРазделы: ${analysis.sections.join(" → ")}.`
      : "";
    return { text: `${analysis.summary}${sectionList}`, sources: [] };
  }

  const cellNumber = normalizedQuestion.match(/(?:ячейк(?:а|е|и|у|ой)?|cell)\s*#?\s*(\d+)/i)?.[1];
  if (cellNumber) {
    const index = Number(cellNumber) - 1;
    const cell = notebook.cells[index];
    if (cell) {
      const source = cellSource(cell).trim();
      const excerpt = source.length > 700 ? `${source.slice(0, 697)}…` : source;
      const output = cell.outputs.map(outputSource).filter(Boolean).join("\n").trim();
      return {
        text: [
          explainNotebookCell(cell, index),
          excerpt ? `\n\nКод или текст ячейки ${index + 1}:\n${excerpt}` : "",
          output ? `\n\nСохранённый результат:\n${output.slice(0, 500)}` : "",
        ].join(""),
        sources: [index],
      };
    }
  }

  const terms = [...new Set(
    normalizedQuestion.toLocaleLowerCase().match(/[а-яёa-z_][а-яёa-z0-9_]*/gi) ?? [],
  )].filter(term => term.length > 1 && !QUESTION_STOP_WORDS.has(term));
  const asksForLibraries = /библиотек|импорт|packages?|libraries/i.test(normalizedQuestion);
  const asksForDataSources = /данн|файл|источник|dataset|csv|excel/i.test(normalizedQuestion);
  const ranked = notebook.cells
    .map((cell, index) => {
      const rawSource = cellSource(cell);
      const source = `${rawSource}\n${cell.outputs.map(outputSource).join("\n")}`.toLocaleLowerCase();
      const score = terms.reduce((total, term) => total + (source.includes(term) ? 1 : 0), 0)
        + (asksForLibraries && /^\s*(?:import\s+\w+|from\s+\w+\s+import)/m.test(rawSource) ? 2 : 0)
        + (asksForDataSources && /\b(read_csv|read_excel|read_json|read_parquet|read_sql|load_dataset|open)\s*\(/i.test(rawSource) ? 2 : 0);
      return { cell, index, score };
    })
    .filter(match => match.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3);

  if (ranked.length === 0) {
    const availableSections = analysis.sections.length
      ? ` В ноутбуке есть разделы: ${analysis.sections.slice(0, 5).join(", ")}.`
      : "";
    return {
      text: `Не нашёл в ячейках явного совпадения с этим вопросом. Попробуйте спросить о названии переменной, функции, разделе или конкретной ячейке.${availableSections}`,
      sources: [],
    };
  }

  const answers = ranked.map(({ cell, index, score }) => {
    const rawSource = cellSource(cell).trim();
    const output = cell.outputs.map(outputSource).filter(Boolean).join("\n").trim();
    const quote = cell.type === "markdown" ? markdownText(rawSource) : rawSource;
    const excerpt = quote.length > 560 ? `${quote.slice(0, 557)}…` : quote;
    const outputExcerpt = output.length > 350 ? `${output.slice(0, 347)}…` : output;
    return [
      `Ячейка ${index + 1} (${score} совпадений): ${explainNotebookCell(cell, index)}`,
      excerpt ? `Фрагмент: “${excerpt}”` : "",
      outputExcerpt ? `Сохранённый результат: “${outputExcerpt}”` : "",
    ].filter(Boolean).join("\n");
  });

  return {
    text: `Нашёл это в ноутбуке:\n\n${answers.join("\n\n")}`,
    sources: ranked.map(match => match.index),
  };
}

function markdownText(source: string): string {
  return source
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .trim();
}
