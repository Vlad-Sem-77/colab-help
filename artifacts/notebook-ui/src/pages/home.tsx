import { useState, useRef, useEffect } from "react";
import { Upload, Play, Download, Code, FileText, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Notebook, NotebookCell, ParamInfo, parseNotebook, exportNotebook } from "@/lib/notebook";
import { useColabUrl } from "@/hooks/use-colab-url";
import { useRunExperiment } from "@workspace/api-client-react";

function CellHeader({ index, type, onRun, isRunning }: { index: number, type: string, onRun?: () => void, isRunning?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 bg-muted/50 border-b border-border">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground">[{index + 1}]</span>
        {type === 'markdown' && <Badge variant="secondary" className="bg-gray-800 text-gray-300"><FileText className="w-3 h-3 mr-1"/> Markdown</Badge>}
        {type === 'code' && <Badge variant="secondary" className="bg-blue-950 text-blue-300"><Code className="w-3 h-3 mr-1"/> Code</Badge>}
        {type === 'parameter' && <Badge variant="secondary" className="bg-orange-950 text-orange-300"><Settings2 className="w-3 h-3 mr-1"/> Parameters</Badge>}
      </div>
      {(type === 'parameter' || type === 'code') && onRun && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRun} disabled={isRunning}>
          {isRunning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
          Run
        </Button>
      )}
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
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, any>>>({});
  const [cellResults, setCellResults] = useState<Record<string, any>>({});
  const [runningCells, setRunningCells] = useState<Record<string, boolean>>({});
  
  const { colabUrl } = useColabUrl();
  const { toast } = useToast();
  const runExperiment = useRunExperiment();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const parsed = parseNotebook(json);
        setNotebook(parsed);
        setCellValues({});
        setCellResults({});
      } catch (err) {
        toast({ title: "Error parsing notebook", variant: "destructive" });
      }
    };
    reader.readAsText(file);
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
      toast({ title: "Colab URL required", description: "Set your ngrok URL in the sidebar.", variant: "destructive" });
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
        setCellResults(prev => ({ ...prev, [cell.id]: "Regular code cell run is not hooked up to a generic execution API yet." }));
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

  if (!notebook) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2">Upload Notebook</h2>
            <p className="text-muted-foreground">Load a .ipynb file to start experimenting.</p>
          </div>
          <div className="relative">
            <Input type="file" accept=".ipynb" onChange={handleFileUpload} className="hidden" id="file-upload" />
            <Button asChild className="w-full" size="lg">
              <label htmlFor="file-upload" className="cursor-pointer">Select File</label>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold">Interactive Notebook</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {notebook.cells.map((cell, index) => {
          let borderColor = "border-gray-500";
          if (cell.type === 'code') borderColor = "border-blue-500";
          if (cell.type === 'parameter') borderColor = "border-orange-500";

          return (
            <div key={cell.id} className={`bg-card rounded-lg border overflow-hidden shadow-sm flex flex-col`}>
              <div className="flex">
                <div className={`w-1 shrink-0 bg-opacity-80 ${borderColor.replace('border-', 'bg-')}`} />
                <div className="flex-1 min-w-0">
                  <CellHeader 
                    index={index} 
                    type={cell.type} 
                    onRun={() => handleRunCell(cell)} 
                    isRunning={runningCells[cell.id]} 
                  />
                  
                  <div className="p-4">
                    {cell.type === 'markdown' && (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        {cell.source.join("")}
                      </div>
                    )}

                    {cell.type === 'code' && (
                      <pre className="text-sm font-mono p-4 rounded bg-muted/50 overflow-x-auto text-blue-100">
                        {cell.source.join("")}
                      </pre>
                    )}

                    {cell.type === 'parameter' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <div className="bg-muted/50 rounded p-4 font-mono text-xs overflow-x-auto text-orange-100">
                          {cell.source.join("")}
                        </div>
                      </div>
                    )}
                  </div>

                  {cellResults[cell.id] && (
                    <div className="bg-black/50 border-t p-4">
                      <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap">
                        {cellResults[cell.id]}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
