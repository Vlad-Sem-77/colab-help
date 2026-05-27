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
  params?: ParamInfo[];
}

export interface Notebook {
  cells: NotebookCell[];
}

export function parseNotebook(json: any): Notebook {
  if (!json || !json.cells || !Array.isArray(json.cells)) {
    return { cells: [] };
  }

  const parsedCells = json.cells.map((c: any, i: number) => {
    const id = c.id || `cell-${i}`;
    const sourceArray = Array.isArray(c.source) ? c.source : [c.source || ""];
    const outputs = c.outputs || [];

    if (c.cell_type === 'markdown') {
      return { id, type: 'markdown', source: sourceArray, outputs };
    } else if (c.cell_type === 'code') {
      const params = detectParams(sourceArray);
      if (params.length > 0) {
        return { id, type: 'parameter', source: sourceArray, outputs, params };
      } else {
        return { id, type: 'code', source: sourceArray, outputs };
      }
    }
    return { id, type: c.cell_type, source: sourceArray, outputs };
  });

  return { cells: parsedCells };
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
  // Simple reconstructor that bakes values in
  const exportData = {
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
      return {
        cell_type: c.type === 'parameter' ? 'code' : c.type,
        source,
        outputs: c.outputs
      };
    }),
    metadata: {},
    nbformat: 4,
    nbformat_minor: 4
  };

  return JSON.stringify(exportData, null, 2);
}
