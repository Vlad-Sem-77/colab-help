import { useEffect, useMemo, useState } from "react";
import { Upload, Play, Download, Code, FileText, Settings2, Loader2, Monitor, Waves } from "lucide-react";
import "./notebook-theme.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { buildNotebookContext } from "@/lib/notebook-context";
import { NotebookAssistant } from "@/components/notebook-assistant";
import {
  Notebook,
  NotebookCell,
  ParamInfo,
  explainNotebookCell,
  parseNotebook,
  exportNotebook,
} from "@/lib/notebook";
import { useColabUrl } from "@/hooks/use-colab-url";
import { useRunExperiment } from "@workspace/api-client-react";
import { NotebookReader } from "@/components/notebook-reader";

type NotebookTheme = "light-waves" | "windows95";

const THEME_STORAGE_KEY = "notebook-ui-theme";

function readSavedTheme(): NotebookTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "windows95"
      ? "windows95"
      : "light-waves";
  } catch {
    return "light-waves";
  }
}

function ThemePicker({
  theme,
  onChange,
}: {
  theme: NotebookTheme;
  onChange: (theme: NotebookTheme) => void;
}) {
  return (
    <div className="notebook-theme-control" role="group" aria-label="Стиль блокнота">
      <button
        type="button"
        aria-pressed={theme === "light-waves"}
        onClick={() => onChange("light-waves")}
        data-testid="button-theme-light-waves"
      >
        <Waves aria-hidden="true" />
        <span>Ньювейв</span>
      </button>
      <button
        type="button"
        aria-pressed={theme === "windows95"}
        onClick={() => onChange("windows95")}
        data-testid="button-theme-windows95"
      >
        <Monitor aria-hidden="true" />
        <span>Олдскул</span>
      </button>
    </div>
  );
}

function CellHeader({ index, type, executionCount, onRun, isRunning }: { index: number, type: string, executionCount?: number | null, onRun?: () => void, isRunning?: boolean }) {
  const displayCount = executionCount === undefined ? index + 1 : executionCount ?? " ";

  return (
    <div className="notebook-cell-header flex items-center justify-between py-2 px-4 bg-muted/50 border-b border-border">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground" data-testid={`text-cell-execution-count-${index}`}>
          [{displayCount}]
        </span>
        {type === 'markdown' && <Badge variant="secondary" className="notebook-cell-badge notebook-cell-badge-markdown"><FileText className="w-3 h-3 mr-1"/> Markdown</Badge>}
        {type === 'code' && <Badge variant="secondary" className="notebook-cell-badge notebook-cell-badge-code"><Code className="w-3 h-3 mr-1"/> Code</Badge>}
        {type === 'parameter' && <Badge variant="secondary" className="notebook-cell-badge notebook-cell-badge-parameter"><Settings2 className="w-3 h-3 mr-1"/> Parameters</Badge>}
      </div>
      {(type === 'parameter' || type === 'code') && onRun && (
        <Button variant="ghost" size="sm" className="notebook-run-button h-7 text-xs" onClick={onRun} disabled={isRunning}>
          {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
          Run
        </Button>
      )}
    </div>
  );
}

function outputText(value: any): string {
  if (Array.isArray(value)) return value.join("");
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? String(value);
}

function NotebookOutput({ output, cellId, index }: { output: any, cellId: string, index: number }) {
  if (output?.output_type === "stream") {
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap" data-testid={`text-cell-output-${cellId}-${index}`}>
        {outputText(output.text)}
      </pre>
    );
  }

  if (output?.output_type === "error") {
    const traceback = Array.isArray(output.traceback) ? output.traceback.join("\n") : "";
    const message = [output.ename, output.evalue].filter(Boolean).join(": ");
    return (
      <pre className="text-sm font-mono text-red-400 whitespace-pre-wrap" data-testid={`text-cell-error-${cellId}-${index}`}>
        {traceback || message || outputText(output)}
      </pre>
    );
  }

  const data = output?.data;
  if (data && typeof data === "object") {
    if (typeof data["text/html"] !== "undefined") {
      return (
        <iframe
          title={`Saved notebook output ${index + 1}`}
          sandbox=""
          srcDoc={outputText(data["text/html"])}
          className="h-64 w-full rounded border bg-white"
          data-testid={`frame-cell-output-${cellId}-${index}`}
        />
      );
    }

    const imageMime = ["image/png", "image/jpeg", "image/gif", "image/webp"]
      .find(mime => typeof data[mime] === "string");
    if (imageMime) {
      return (
        <img
          src={`data:${imageMime};base64,${data[imageMime]}`}
          alt={`Saved output ${index + 1}`}
          className="max-h-96 max-w-full object-contain"
          data-testid={`img-cell-output-${cellId}-${index}`}
        />
      );
    }

    const textMime = ["text/plain", "text/markdown", "application/json"]
      .find(mime => data[mime] !== undefined);
    if (textMime) {
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap" data-testid={`text-cell-output-${cellId}-${index}`}>
          {outputText(data[textMime])}
        </pre>
      );
    }

    return (
      <pre className="text-sm font-mono whitespace-pre-wrap" data-testid={`text-cell-output-${cellId}-${index}`}>
        {outputText(data)}
      </pre>
    );
  }

  return (
    <pre className="text-sm font-mono whitespace-pre-wrap" data-testid={`text-cell-output-${cellId}-${index}`}>
      {outputText(output)}
    </pre>
  );
}

function NotebookOutputs({ outputs, cellId }: { outputs: any[], cellId: string }) {
  if (!outputs.length) return null;

  return (
    <div className="space-y-3" data-testid={`results-cell-${cellId}`}>
      {outputs.map((output, index) => (
        <NotebookOutput key={`${cellId}-${index}`} output={output} cellId={cellId} index={index} />
      ))}
    </div>
  );
}

function ParameterWidget({ param, value, onChange }: { param: ParamInfo, value: any, onChange: (val: any) => void }) {
  const isPrompt = param.varName.includes("prompt");
  const isTemp = param.varName === "temperature";
  const isTokens = param.varName === "max_tokens" || param.varName === "max_length";
  const isTask = param.varName === "task_type";

  if (isPrompt) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
        <Textarea 
          value={value ?? param.defaultValue} 
          onChange={e => onChange(e.target.value)} 
          className="font-mono text-sm min-h-[100px]"
        />
      </div>
    );
  }

  if (isTemp) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
          <span className="text-xs font-mono text-muted-foreground">{value ?? param.defaultValue}</span>
        </div>
        <Slider 
          min={0} max={2} step={0.01} 
          value={[value ?? param.defaultValue]} 
          onValueChange={v => onChange(v[0])} 
        />
      </div>
    );
  }

  if (isTokens) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
          <span className="text-xs font-mono text-muted-foreground">{value ?? param.defaultValue}</span>
        </div>
        <Slider 
          min={64} max={4096} step={64} 
          value={[value ?? param.defaultValue]} 
          onValueChange={v => onChange(v[0])} 
        />
      </div>
    );
  }

  if (param.varType === 'bool') {
    return (
      <div className="flex items-center justify-between py-1">
        <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
        <Switch 
          checked={value ?? param.defaultValue} 
          onCheckedChange={onChange} 
        />
      </div>
    );
  }

  if (isTask) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
        <Select value={value ?? param.defaultValue} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text_generation">text_generation</SelectItem>
            <SelectItem value="model_comparison">model_comparison</SelectItem>
            <SelectItem value="system_prompt">system_prompt</SelectItem>
            <SelectItem value="custom_code">custom_code</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
      <Input 
        value={value ?? param.defaultValue} 
        onChange={e => onChange(e.target.value)} 
        className="font-mono text-sm"
      />
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<NotebookTheme>(readSavedTheme);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, any>>>({});
  const [cellResults, setCellResults] = useState<Record<string, any>>({});
  const [runningCells, setRunningCells] = useState<Record<string, boolean>>({});
  const [notebookRevision, setNotebookRevision] = useState(0);
  
  const { colabUrl } = useColabUrl();
  const { toast } = useToast();
  const runExperiment = useRunExperiment();
  useEffect(() => {
    document.documentElement.dataset.notebookTheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still works for this visit when browser storage is unavailable.
    }
    return () => {
      delete document.documentElement.dataset.notebookTheme;
    };
  }, [theme]);

  const notebookContext = useMemo(
    () => notebook ? buildNotebookContext(notebook, cellResults) : "",
    [notebook, cellResults],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const input = e.currentTarget;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const parsed = parseNotebook(json);
        setNotebook(parsed);
        setNotebookRevision(revision => revision + 1);
        setCellValues({});
        setCellResults({});
      } catch (err) {
        toast({
          title: "Не удалось прочитать блокнот",
          description: err instanceof Error ? err.message : "Проверьте файл .ipynb.",
          variant: "destructive",
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Не удалось прочитать файл",
        description: "Попробуйте загрузить файл .ipynb ещё раз.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
    input.value = "";
  };

  const updateCellValue = (cellId: string, varName: string, value: any) => {
    setCellValues(prev => ({
      ...prev,
      [cellId]: {
        ...(prev[cellId] || {}),
        [varName]: value
      }
    }));
  };

  const handleRunCell = async (cell: NotebookCell) => {
    if (!colabUrl) {
      toast({ title: "Colab URL required", description: "Вставьте Cloudflare URL из Colab в сайдбар.", variant: "destructive" });
      return;
    }

    setRunningCells(prev => ({ ...prev, [cell.id]: true }));

    try {
      if (cell.type === 'parameter') {
        const values = cellValues[cell.id] || {};
        const getVal = (name: string, def: any) => values[name] !== undefined ? values[name] : def;
        
        const prompt = getVal("prompt", "");
        const temperature = getVal("temperature", 0.7);
        const maxTokens = getVal("max_tokens", 1024) || getVal("max_length", 1024);
        const systemPrompt = getVal("system_prompt", undefined);
        const taskType = getVal("task_type", "text_generation");
        const model = getVal("model", undefined);

        const res = await runExperiment.mutateAsync({
          data: {
            colabUrl,
            mode: "auto",
            taskType,
            model,
            params: {
              prompt,
              temperature,
              maxTokens,
              systemPrompt
            }
          }
        });

        setCellResults(prev => ({ ...prev, [cell.id]: res.result || res.error }));
      } else {
        const source = cell.source.join("");
        const resp = await fetch("/api/colab/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colabUrl, code: source }),
        });
        const data = await resp.json();
        if (!resp.ok || data.status === "error") {
          const errText = data.stderr || data.error || "Execution failed";
          setCellResults(prev => ({ ...prev, [cell.id]: `❌ Error:\n${errText}` }));
        } else {
          const out = [data.stdout, data.stderr ? `[stderr]\n${data.stderr}` : ""].filter(Boolean).join("\n") || "(no output)";
          setCellResults(prev => ({ ...prev, [cell.id]: out }));
        }
      }
    } catch (err: any) {
      setCellResults(prev => ({ ...prev, [cell.id]: `Error: ${err.message || "Failed to run"}` }));
    } finally {
      setRunningCells(prev => ({ ...prev, [cell.id]: false }));
    }
  };

  const handleDownload = () => {
    if (!notebook) return;
    const jsonStr = exportNotebook(notebook, cellValues);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notebook_exported.ipynb";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="notebook-page" data-notebook-theme={theme} data-testid="page-notebook">
      <div className="notebook-page-inner">
        <header className="notebook-page-header">
          <div className="notebook-page-brand">
            <div className="notebook-brand-icon"><FileText aria-hidden="true" /></div>
            <div>
              <p className="notebook-eyebrow">COLAB READER</p>
              <h1>Notebook Reader</h1>
              <p className="notebook-page-subtitle">Изучайте блокноты и их результаты в удобном стиле.</p>
            </div>
          </div>
          <ThemePicker theme={theme} onChange={setTheme} />
        </header>

        {!notebook ? (
          <section className="notebook-upload-card" data-testid="card-notebook-upload">
            <div className="notebook-upload-icon"><Upload aria-hidden="true" /></div>
            <p className="notebook-eyebrow">ВАШ РАБОЧИЙ БЛОКНОТ</p>
            <h2>Начните с файла .ipynb</h2>
            <p className="notebook-upload-description">
              Просматривайте текст, параметры, код и сохранённые результаты. Исходный файл останется на вашем устройстве.
            </p>
            <Input type="file" accept=".ipynb" onChange={handleFileUpload} className="hidden" id="file-upload" data-testid="input-upload-notebook" />
            <Button asChild className="notebook-upload-button" size="lg">
              <label htmlFor="file-upload" className="cursor-pointer"><Upload aria-hidden="true" /> Выбрать блокнот</label>
            </Button>
            <p className="notebook-upload-footnote">Поддерживаются файлы Jupyter Notebook (.ipynb)</p>
          </section>
        ) : (
          <div className="notebook-content">
            <section className="notebook-document-toolbar">
              <div>
                <p className="notebook-eyebrow">РАБОЧАЯ ОБЛАСТЬ</p>
                <h2>Блокнот готов</h2>
                <p>Ячеек: {notebook.cells.length} · результат и параметры доступны ниже</p>
              </div>
              <div className="notebook-document-actions">
                <Input
                  type="file"
                  accept=".ipynb"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="replace-notebook-file"
                  data-testid="input-replace-notebook"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="replace-notebook-file" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Другой файл
                  </label>
                </Button>
                <Button variant="outline" onClick={handleDownload} data-testid="button-download-notebook">
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
              </div>
            </section>

            <NotebookReader
              key={notebookRevision}
              notebook={notebook}
              notebookContext={notebookContext}
              colabUrl={colabUrl || null}
            />

            <div className="notebook-cell-list">
              {notebook.cells.map((cell, index) => {
                let borderColor = "border-gray-500";
                if (cell.type === 'code') borderColor = "border-blue-500";
                if (cell.type === 'parameter') borderColor = "border-orange-500";

                return (
                  <section key={cell.id} className="notebook-cell" data-notebook-cell-type={cell.type}>
                    <div className="flex min-w-0">
                      <div className={`notebook-cell-mark w-1 shrink-0 bg-opacity-80 ${borderColor.replace('border-', 'bg-')}`} />
                      <div className="notebook-cell-column flex-1 min-w-0">
                        <CellHeader
                          index={index}
                          type={cell.type}
                          executionCount={cell.execution_count}
                          onRun={() => handleRunCell(cell)}
                          isRunning={runningCells[cell.id]}
                        />

                        <div className="notebook-cell-body p-4">
                          {cell.type === 'markdown' && (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                              {cell.source.join("")}
                            </div>
                          )}

                          {cell.type === 'code' && (
                            <pre className="notebook-code-source text-sm font-mono p-4 rounded bg-muted/50 overflow-x-auto text-blue-100">
                              {cell.source.join("")}
                            </pre>
                          )}

                          {cell.type === 'parameter' && (
                            <div className="notebook-parameter-grid grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                {cell.params?.map(p => (
                                  <ParameterWidget
                                    key={p.varName}
                                    param={p}
                                    value={cellValues[cell.id]?.[p.varName]}
                                    onChange={(val) => updateCellValue(cell.id, p.varName, val)}
                                  />
                                ))}
                              </div>
                              <div className="notebook-parameter-source bg-muted/50 rounded p-4 font-mono text-xs overflow-x-auto text-orange-100">
                                {cell.source.join("")}
                              </div>
                            </div>
                          )}
                          <p
                            className="notebook-cell-explanation mt-4 border-t pt-3 text-sm leading-relaxed text-muted-foreground"
                            data-testid={`text-cell-explanation-${index}`}
                          >
                            <span className="font-medium text-foreground">Пояснение: </span>
                            {explainNotebookCell(cell, index)}
                          </p>
                        </div>

                        {cellResults[cell.id] !== undefined ? (
                          <div className="notebook-cell-output border-t p-4" data-testid={`result-live-${cell.id}`}>
                            <pre className="text-sm font-mono whitespace-pre-wrap">{outputText(cellResults[cell.id])}</pre>
                          </div>
                        ) : cell.outputs.length > 0 ? (
                          <div className="notebook-cell-output border-t p-4">
                            <NotebookOutputs outputs={cell.outputs} cellId={cell.id} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <NotebookAssistant
              key={`assistant-${notebookRevision}`}
              notebookContext={notebookContext}
              colabUrl={colabUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
