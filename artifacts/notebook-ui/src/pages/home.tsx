import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Play, Download, Code, FileText, Settings2, Loader2, Monitor, Waves, SkipForward, RotateCcw, CheckCircle2 } from "lucide-react";
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
import { AiProviderSettings } from "@/components/ai-provider-settings";
import { getListAiProvidersQueryKey, useListAiModels, useListAiProviders } from "@workspace/api-client-react";
import type { AiSettings } from "@/lib/ai-settings";
import {
  getActiveAiModelId,
  readSavedAiSettings,
  saveAiSettings,
} from "@/lib/ai-settings";
import {
  Notebook,
  NotebookCell,
  ParamInfo,
  CellEnabledState,
  canRunNotebookCell,
  clearSavedCellEnabledState,
  createNotebookSettingsId,
  createCellEnabledState,
  explainNotebookCell,
  getRunnableNotebookCells,
  isCellEnabled,
  parseNotebook,
  exportNotebook,
  readSavedCellEnabledState,
  saveCellEnabledState,
  setCellEnabled,
} from "@/lib/notebook";
import { NotebookReader } from "@/components/notebook-reader";

type NotebookTheme = "light-waves" | "windows95";
type CellRunStatus = "running" | "simulated";
type BatchRunState =
  | { status: "running"; currentCellId: string; cellNumber: number; position: number; total: number }
  | { status: "simulated"; completed: number; total: number }
  | { status: "empty" };

const THEME_STORAGE_KEY = "notebook-ui-theme";
const MAX_SIMULATION_DURATION_MS = 2400;
const MAX_SIMULATION_STEP_MS = 180;

function waitForSimulationStep(totalSteps: number): Promise<void> {
  const delay = Math.max(
    24,
    Math.min(MAX_SIMULATION_STEP_MS, Math.ceil(MAX_SIMULATION_DURATION_MS / Math.max(totalSteps, 1))),
  );
  return new Promise(resolve => window.setTimeout(resolve, delay));
}

function readSavedTheme(): NotebookTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "windows95"
      ? "windows95"
      : "light-waves";
  } catch {
    return "light-waves";
  }
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
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

function CellHeader({
  index,
  type,
  executionCount,
  onRun,
  isRunning,
  isEnabled,
  onToggle,
  runStatus,
  controlsDisabled,
}: {
  index: number;
  type: string;
  executionCount?: number | null;
  onRun?: () => void;
  isRunning?: boolean;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  runStatus?: CellRunStatus;
  controlsDisabled?: boolean;
}) {
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
        {!isEnabled && (
          <Badge
            variant="outline"
            className="notebook-cell-status-skipped"
            data-testid={`status-cell-skipped-${index}`}
          >
            <SkipForward className="mr-1 h-3 w-3" aria-hidden="true" />
            Отключена
          </Badge>
        )}
        {runStatus === "running" && (
          <Badge variant="secondary" role="status" data-testid={`status-cell-running-${index}`}>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
            Симулируется
          </Badge>
        )}
        {runStatus === "simulated" && (
          <Badge variant="secondary" data-testid={`status-cell-simulated-${index}`}>
            <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
            Пройдена в симуляции
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {(type === 'parameter' || type === 'code') && onRun && (
          <Button
            variant="ghost"
            size="sm"
            className="notebook-run-button h-7 text-xs"
            onClick={onRun}
            disabled={!isEnabled || isRunning || controlsDisabled}
            data-testid={`button-run-cell-${index}`}
          >
            {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
            {isRunning ? "Симулируется" : "Симулировать"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {isEnabled ? "В потоке" : "Пропускается"}
        </span>
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggle}
          disabled={controlsDisabled}
          aria-label={`${isEnabled ? "Отключить" : "Включить"} ячейку ${index + 1}`}
          data-testid={`switch-cell-enabled-${index}`}
        />
      </div>
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

function ParameterWidget({
  param,
  value,
  onChange,
  disabled,
}: {
  param: ParamInfo;
  value: any;
  onChange: (val: any) => void;
  disabled: boolean;
}) {
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
          disabled={disabled}
          data-testid={`parameter-${param.varName}`}
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
          disabled={disabled}
          data-testid={`parameter-${param.varName}`}
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
          disabled={disabled}
          data-testid={`parameter-${param.varName}`}
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
          disabled={disabled}
          data-testid={`parameter-${param.varName}`}
        />
      </div>
    );
  }

  if (isTask) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium font-mono text-muted-foreground">{param.varName}</label>
        <Select value={value ?? param.defaultValue} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger disabled={disabled} data-testid={`parameter-${param.varName}`}>
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
        disabled={disabled}
        data-testid={`parameter-${param.varName}`}
      />
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<NotebookTheme>(readSavedTheme);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, any>>>({});
  const [cellEnabled, setCellEnabledState] = useState<CellEnabledState>({});
  const [notebookSettingsId, setNotebookSettingsId] = useState<string | null>(null);
  const [rememberCellSettings, setRememberCellSettings] = useState(false);
  const [cellResults, setCellResults] = useState<Record<string, any>>({});
  const [runningCells, setRunningCells] = useState<Record<string, boolean>>({});
  const [cellRunStatuses, setCellRunStatuses] = useState<Record<string, CellRunStatus>>({});
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchRunState, setBatchRunState] = useState<BatchRunState | null>(null);
  const [notebookRevision, setNotebookRevision] = useState(0);
  const [aiSettings, setAiSettings] = useState<AiSettings>(readSavedAiSettings);
  const [allowOnlineAi, setAllowOnlineAi] = useState(false);
  const queryClient = useQueryClient();
  const aiProvidersQuery = useListAiProviders({ query: { staleTime: 60_000 } });
  const selectedAiProvider = aiProvidersQuery.data?.providers.find(
    (provider) => provider.id === aiSettings.providerId,
  );
  const canLoadModelCatalog = Boolean(
    selectedAiProvider && (!selectedAiProvider.catalogRequiresKey || selectedAiProvider.hasSessionKey),
  );
  const aiModelsQuery = useListAiModels(
    { providerId: aiSettings.providerId },
    {
      query: {
        staleTime: 120_000,
        enabled: canLoadModelCatalog,
        queryKey: ["listAiModels", aiSettings.providerId, selectedAiProvider?.hasSessionKey ?? false],
      },
    },
  );
  const activeAiModelId = getActiveAiModelId(aiSettings);
  const aiModelIsAvailable = aiModelsQuery.data?.models.some((model) => model.id === activeAiModelId) ?? false;
  const aiReady = Boolean(selectedAiProvider?.hasSessionKey && activeAiModelId && aiModelIsAvailable);

  const { toast } = useToast();
  const handleAiSettingsChange = (nextSettings: AiSettings) => {
    if (nextSettings.providerId !== aiSettings.providerId) {
      setAllowOnlineAi(false);
    }
    setAiSettings(nextSettings);
  };

  const connectProviderKey = async (apiKey: string) => {
    const providerId = aiSettings.providerId;
    const response = await fetch("/api/ai/credentials/connect", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, apiKey }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(result?.error ?? `Не удалось подключить ключ (HTTP ${response.status}).`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["listAiModels", providerId] }),
    ]);
    setAllowOnlineAi(false);
  };

  const disconnectProviderKey = async () => {
    const providerId = aiSettings.providerId;
    const response = await fetch(`/api/ai/credentials/${encodeURIComponent(providerId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`Не удалось удалить ключ (HTTP ${response.status}).`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAiProvidersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["listAiModels", providerId] }),
    ]);
    setAllowOnlineAi(false);
  };

  useEffect(() => {
    saveAiSettings(aiSettings);
  }, [aiSettings]);

  useEffect(() => {
    setAllowOnlineAi(false);
  }, [notebookRevision]);

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
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const parsed = parseNotebook(json);
        const settingsId = await createNotebookSettingsId(parsed);
        const storage = getLocalStorage();
        const savedState = storage
          ? readSavedCellEnabledState(storage, settingsId, parsed.cells)
          : null;

        setNotebook(parsed);
        setNotebookSettingsId(settingsId);
        setCellEnabledState(savedState ?? createCellEnabledState(parsed.cells));
        setRememberCellSettings(savedState !== null);
        setNotebookRevision(revision => revision + 1);
        setCellValues({});
        setCellResults({});
        setCellRunStatuses({});
        setBatchRunState(null);
      } catch (err) {
        toast({
          title: "Не удалось прочитать блокнот",
          description: err instanceof SyntaxError
            ? "Файл повреждён: содержимое не является корректным JSON. Проверьте файл .ipynb и попробуйте снова."
            : err instanceof Error
              ? err.message
              : "Проверьте файл .ipynb.",
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

  const updateCellEnabled = (cellId: string, enabled: boolean) => {
    const updatedState = setCellEnabled(cellEnabled, cellId, enabled);
    setCellEnabledState(updatedState);
    if (rememberCellSettings && notebookSettingsId) {
      const storage = getLocalStorage();
      if (!storage || !saveCellEnabledState(storage, notebookSettingsId, updatedState)) {
        toast({
          title: "Не удалось сохранить настройки",
          description: "Изменение применено, но не сохранено для следующего посещения.",
          variant: "destructive",
        });
      }
    }
  };

  const updateRememberCellSettings = (remember: boolean) => {
    if (!notebookSettingsId) return;
    const storage = getLocalStorage();
    if (!storage) {
      toast({
        title: "Хранилище браузера недоступно",
        description: "Настройки ячеек можно сохранять только при доступном хранилище браузера.",
        variant: "destructive",
      });
      return;
    }

    const updated = remember
      ? saveCellEnabledState(storage, notebookSettingsId, cellEnabled)
      : clearSavedCellEnabledState(storage, notebookSettingsId);
    if (!updated) {
      toast({
        title: "Не удалось изменить настройки",
        description: "Проверьте доступность хранилища браузера и попробуйте ещё раз.",
        variant: "destructive",
      });
      return;
    }
    setRememberCellSettings(remember);
  };

  const resetCellSettings = () => {
    if (!notebook || !notebookSettingsId) return;
    const storage = getLocalStorage();
    if (!storage || !clearSavedCellEnabledState(storage, notebookSettingsId)) {
      toast({
        title: "Не удалось сбросить настройки",
        description: "Настройки остались сохранены в хранилище браузера.",
        variant: "destructive",
      });
      return;
    }

    setCellEnabledState(createCellEnabledState(notebook.cells));
    setRememberCellSettings(false);
    toast({ title: "Настройки ячеек сброшены" });
  };

  const handleRunCell = async (cell: NotebookCell) => {
    if (!canRunNotebookCell(cell, cellEnabled)) return;
    if (isBatchRunning) return;

    setRunningCells(prev => ({ ...prev, [cell.id]: true }));
    setCellRunStatuses(prev => ({ ...prev, [cell.id]: "running" }));
    setBatchRunState(null);

    try {
      await waitForSimulationStep(1);
      setCellRunStatuses(prev => ({ ...prev, [cell.id]: "simulated" }));
    } finally {
      setRunningCells(prev => ({ ...prev, [cell.id]: false }));
    }
  };

  const handleRunEnabledCells = async () => {
    if (!notebook || isBatchRunning || Object.values(runningCells).some(Boolean)) return;

    const cellsToRun = getRunnableNotebookCells(notebook.cells, cellEnabled);
    if (cellsToRun.length === 0) {
      setBatchRunState({ status: "empty" });
      return;
    }

    setIsBatchRunning(true);
    setBatchRunState({
      status: "running",
      currentCellId: cellsToRun[0].id,
      cellNumber: notebook.cells.indexOf(cellsToRun[0]) + 1,
      position: 1,
      total: cellsToRun.length,
    });
    setCellRunStatuses({});

    let completed = 0;
    try {
      for (let index = 0; index < cellsToRun.length; index += 1) {
        const cell = cellsToRun[index];
        setBatchRunState({
          status: "running",
          currentCellId: cell.id,
          cellNumber: notebook.cells.indexOf(cell) + 1,
          position: index + 1,
          total: cellsToRun.length,
        });
        setRunningCells(prev => ({ ...prev, [cell.id]: true }));
        setCellRunStatuses(prev => ({ ...prev, [cell.id]: "running" }));

        await waitForSimulationStep(cellsToRun.length);
        setCellRunStatuses(prev => ({ ...prev, [cell.id]: "simulated" }));
        setRunningCells(prev => ({ ...prev, [cell.id]: false }));
        completed += 1;
      }

      setBatchRunState({ status: "simulated", completed, total: cellsToRun.length });
    } finally {
      setIsBatchRunning(false);
      setRunningCells(prev => {
        const next = { ...prev };
        for (const cell of cellsToRun) delete next[cell.id];
        return next;
      });
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
            <section
              className="rounded-md border border-primary/25 bg-primary/5 p-4 text-sm"
              role="note"
              data-testid="notice-simulation-mode"
            >
              <p className="font-semibold">Режим симуляции — код не запускается</p>
              <p className="mt-1 text-muted-foreground">
                Кнопки показывают порядок ячеек и пропуск выключенных. Новые результаты не создаются, Colab для этого не нужен.
              </p>
            </section>
            <section className="notebook-document-toolbar">
              <div>
                <p className="notebook-eyebrow">РАБОЧАЯ ОБЛАСТЬ</p>
                <h2>Блокнот готов</h2>
                <p>Ячеек: {notebook.cells.length} · результат и параметры доступны ниже</p>
                <p className="notebook-cell-toggle-note">
                  Отключённые ячейки пропускаются в симуляции. При желании сохраняйте их состояние отдельно от .ipynb.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rememberCellSettings}
                      onCheckedChange={updateRememberCellSettings}
                      aria-label="Сохранять настройки ячеек этого блокнота"
                      data-testid="switch-remember-cell-settings"
                    />
                    <span className="text-sm">Запоминать переключатели в этом браузере</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetCellSettings}
                    data-testid="button-reset-cell-settings"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Сбросить настройки ячеек
                  </Button>
                </div>
              </div>
              <div className="notebook-document-actions">
                <Button
                  onClick={handleRunEnabledCells}
                  disabled={isBatchRunning || Object.values(runningCells).some(Boolean)}
                  data-testid="button-run-enabled-cells"
                >
                  {isBatchRunning
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    : <Play className="w-4 h-4 mr-2" aria-hidden="true" />}
                  Симулировать включённые ячейки
                </Button>
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

            {batchRunState && (
              <section
                className="rounded-md border bg-card p-4 text-sm"
                role="status"
                aria-live="polite"
                data-testid="status-batch-run"
              >
                {batchRunState.status === "running" && (
                  <p>
                    Симуляция: ячейка {batchRunState.cellNumber} — шаг {batchRunState.position} из {batchRunState.total}. Код не запускается.
                  </p>
                )}
                {batchRunState.status === "simulated" && (
                  <p>Симуляция завершена: просмотрено {batchRunState.completed} из {batchRunState.total} включённых ячеек. Python-код не выполнялся.</p>
                )}
                {batchRunState.status === "empty" && (
                  <p>Нет включённых кодовых или параметрических ячеек для симуляции.</p>
                )}
              </section>
            )}

            <AiProviderSettings
              settings={aiSettings}
              providers={aiProvidersQuery.data?.providers ?? []}
              models={aiModelsQuery.data?.models ?? []}
              providersLoading={aiProvidersQuery.isLoading}
              modelsLoading={aiModelsQuery.isLoading}
              catalogError={aiModelsQuery.isError}
              sessionKeyActive={Boolean(selectedAiProvider?.hasSessionKey)}
              onApplyApiKey={connectProviderKey}
              onClearApiKey={disconnectProviderKey}
              onChange={handleAiSettingsChange}
            />
            <NotebookReader
              key={notebookRevision}
              notebook={notebook}
              notebookContext={notebookContext}
              providerId={aiSettings.providerId}
              modelId={activeAiModelId}
              profile={aiSettings.profile}
              aiReady={aiReady}
              allowOnlineAi={allowOnlineAi}
              onAllowOnlineAiChange={setAllowOnlineAi}
            />

            <div className="notebook-cell-list">
              {notebook.cells.map((cell, index) => {
                let borderColor = "border-gray-500";
                if (cell.type === 'code') borderColor = "border-blue-500";
                if (cell.type === 'parameter') borderColor = "border-orange-500";

                return (
                  <section
                    key={cell.id}
                    id={`notebook-cell-${index}`}
                    className="notebook-cell"
                    data-notebook-cell-type={cell.type}
                    data-cell-enabled={isCellEnabled(cellEnabled, cell.id)}
                  >
                    <div className="flex min-w-0">
                      <div className={`notebook-cell-mark w-1 shrink-0 bg-opacity-80 ${borderColor.replace('border-', 'bg-')}`} />
                      <div className="notebook-cell-column flex-1 min-w-0">
                        <CellHeader
                          index={index}
                          type={cell.type}
                          executionCount={cell.execution_count}
                          onRun={() => handleRunCell(cell)}
                          isRunning={runningCells[cell.id]}
                          runStatus={cellRunStatuses[cell.id]}
                          controlsDisabled={isBatchRunning}
                          isEnabled={isCellEnabled(cellEnabled, cell.id)}
                          onToggle={(enabled) => updateCellEnabled(cell.id, enabled)}
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
                                    disabled={!isCellEnabled(cellEnabled, cell.id)}
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
                            <Badge variant="outline" className="mb-3">Результат этой сессии — симуляция его не обновляла</Badge>
                            <pre className="text-sm font-mono whitespace-pre-wrap">
                              {outputText(cellResults[cell.id])}
                            </pre>
                          </div>
                        ) : cell.outputs.length > 0 ? (
                          <div className="notebook-cell-output border-t p-4" data-testid={`saved-results-${cell.id}`}>
                            <div className="mb-3">
                              <Badge variant="outline" data-testid={`badge-saved-output-${cell.id}`}>
                                Сохранённый результат из исходного .ipynb
                              </Badge>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Симуляция не пересчитывает и не обновляет этот вывод.
                              </p>
                            </div>
                            <NotebookOutputs outputs={cell.outputs} cellId={cell.id} />
                          </div>
                        ) : cellRunStatuses[cell.id] === "simulated" ? (
                          <div
                            className="notebook-cell-output border-t p-4 text-sm text-muted-foreground"
                            role="note"
                            data-testid={`simulation-no-output-${cell.id}`}
                          >
                            Ячейка пройдена в симуляции. Код не выполнялся, нового результата нет.
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
              providerId={aiSettings.providerId}
              modelId={activeAiModelId}
              profile={aiSettings.profile}
              voiceInputAvailable={Boolean(selectedAiProvider?.voiceInputAvailable)}
              voiceOutputAvailable={Boolean(selectedAiProvider?.voiceOutputAvailable)}
              aiReady={aiReady}
              allowOnlineAi={allowOnlineAi}
            />
          </div>
        )}
      </div>
    </div>
  );
}
