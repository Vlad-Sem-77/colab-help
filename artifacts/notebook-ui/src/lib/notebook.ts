export type CellType = 'markdown' | 'code' | 'parameter';

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

export interface Notebook {
  cells: NotebookCell[];
  metadata?: Record<string, any>;
  nbformat?: number;
  nbformat_minor?: number;
  original?: Record<string, any>;
}

export function parseNotebook(json: any): Notebook {
  if (!json || !json.cells || !Array.isArray(json.cells)) {
    return { cells: [] };
  }

  const parsedCells = json.cells.map((c: any, i: number) => {
    const id = c.id || `cell-${i}`;
    const sourceArray = Array.isArray(c.source) ? c.source : [c.source || ""];
    const outputs = Array.isArray(c.outputs) ? c.outputs : [];
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
    return { ...commonFields, type: c.cell_type };
  });

  return {
    cells: parsedCells,
    metadata: json.metadata,
    nbformat: json.nbformat,
    nbformat_minor: json.nbformat_minor,
    original: json,
  };
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
