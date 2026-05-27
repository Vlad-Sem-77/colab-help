import { useState, useEffect } from "react";
import { 
  PlayIcon, 
  Settings2Icon, 
  DatabaseIcon, 
  TerminalIcon, 
  CpuIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  DownloadIcon,
  Code2Icon
} from "lucide-react";
import { 
  usePingColab, 
  useFetchFreeModels, 
  useRunExperiment,
  ExperimentInputTaskType,
  ExperimentInputMode,
  ExperimentResult
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  
  // Persisted state
  const [colabUrl, setColabUrl] = useState(() => localStorage.getItem("bridge_colabUrl") || "");
  
  // Connection state
  const [isPingOk, setIsPingOk] = useState<boolean | null>(null);
  
  // Experiment configuration
  const [mode, setMode] = useState<typeof ExperimentInputMode[keyof typeof ExperimentInputMode]>(ExperimentInputMode.auto);
  const [taskType, setTaskType] = useState<typeof ExperimentInputTaskType[keyof typeof ExperimentInputTaskType]>(ExperimentInputTaskType.text_generation);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  
  // Parameters
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [customCode, setCustomCode] = useState("");
  
  // View states
  const [showCode, setShowCode] = useState(false);
  const [experimentResult, setExperimentResult] = useState<ExperimentResult | null>(null);

  useEffect(() => {
    localStorage.setItem("bridge_colabUrl", colabUrl);
  }, [colabUrl]);

  // API Hooks
  const pingMutation = usePingColab({
    mutation: {
      onSuccess: (data) => {
        setIsPingOk(data.online);
        toast({
          title: data.online ? "Connection Established" : "Connection Failed",
          description: data.message,
          variant: data.online ? "default" : "destructive",
        });
      },
      onError: () => {
        setIsPingOk(false);
        toast({ title: "Error", description: "Failed to connect to Colab URL", variant: "destructive" });
      }
    }
  });

  const fetchModelsMutation = useFetchFreeModels({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Models Loaded", description: `Found ${data.count} free models.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to fetch models", variant: "destructive" });
      }
    }
  });

  const runMutation = useRunExperiment({
    mutation: {
      onSuccess: (data) => {
        setExperimentResult(data);
        setShowCode(false);
        if (data.status === 'error') {
          toast({ title: "Experiment Failed", description: data.error || "Unknown error", variant: "destructive" });
        } else {
          toast({ title: "Experiment Complete", description: "Results are ready." });
        }
      },
      onError: (err: any) => {
        toast({ title: "Execution Error", description: err.message || "Failed to run", variant: "destructive" });
      }
    }
  });

  const handlePing = () => {
    if (!colabUrl) return toast({ title: "URL Required", description: "Please enter your Colab URL (trycloudflare.com)", variant: "destructive" });
    pingMutation.mutate({ data: { colabUrl } });
  };

  const handleLoadModels = () => {
    if (!colabUrl) return toast({ title: "URL Required", variant: "destructive" });
    fetchModelsMutation.mutate({ data: { colabUrl } });
  };

  const handleRun = () => {
    if (!colabUrl) return toast({ title: "URL Required", variant: "destructive" });
    if (!prompt.trim() && taskType !== 'custom_code') return toast({ title: "Prompt Required", variant: "destructive" });
    if (taskType === 'custom_code' && !customCode.trim()) return toast({ title: "Code Required", variant: "destructive" });
    
    if (mode === 'manual' && taskType !== 'model_comparison' && !selectedModel) {
      return toast({ title: "Model Required", description: "Select a model or switch to Auto mode", variant: "destructive" });
    }

    if (mode === 'manual' && taskType === 'model_comparison' && selectedModels.length < 2) {
      return toast({ title: "Models Required", description: "Select at least 2 models for comparison", variant: "destructive" });
    }

    runMutation.mutate({
      data: {
        colabUrl,
        taskType,
        mode,
        model: taskType !== 'model_comparison' ? selectedModel || undefined : undefined,
        models: taskType === 'model_comparison' && selectedModels.length > 0 ? selectedModels : undefined,
        params: {
          prompt,
          temperature,
          maxTokens,
          systemPrompt: systemPrompt || undefined,
          customCode: taskType === 'custom_code' ? customCode : undefined
        }
      }
    });
  };

  const generatePythonCode = () => {
    return `import requests\nimport json\n\nurl = "${colabUrl}/api/run"\nheaders = {"Content-Type": "application/json"}\ndata = {\n    "taskType": "${taskType}",\n    "mode": "${mode}",\n    "model": ${selectedModel && taskType !== 'model_comparison' ? `"${selectedModel}"` : "None"},\n    "models": ${taskType === 'model_comparison' ? JSON.stringify(selectedModels) : "None"},\n    "params": {\n        "prompt": ${JSON.stringify(prompt)},\n        "temperature": ${temperature},\n        "maxTokens": ${maxTokens}${systemPrompt ? `,\n        "systemPrompt": ${JSON.stringify(systemPrompt)}` : ''}${customCode ? `,\n        "customCode": ${JSON.stringify(customCode)}` : ''}\n    }\n}\n\nresponse = requests.post(url, headers=headers, json=data)\nprint(json.dumps(response.json(), indent=2))`;
  };

  const handleDownloadTxt = () => {
    if (!experimentResult) return;
    const content = `EXPERIMENT REPORT\n=================\nTask: ${experimentResult.taskType}\nMode: ${experimentResult.mode}\n\nPROMPT:\n${prompt}\n\nRESULT:\n${experimentResult.result || ''}\n\nCOMPARISONS:\n${experimentResult.comparisons?.map(c => `[${c.modelId}]\n${c.result}\n`).join('\n') || ''}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const modelsList = fetchModelsMutation.data?.models || [];
  const activeModelInfo = modelsList.find(m => m.id === selectedModel);

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* LEFT PANEL - CONTROLS */}
      <div className="w-[450px] flex-shrink-0 border-r border-border bg-card flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">Connection</Label>
            {isPingOk === true && <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 font-mono text-[10px]"><CheckCircle2Icon className="w-3 h-3 mr-1"/> OK</Badge>}
            {isPingOk === false && <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 font-mono text-[10px]"><AlertCircleIcon className="w-3 h-3 mr-1"/> ERR</Badge>}
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="https://xxxx.trycloudflare.com" 
              value={colabUrl} 
              onChange={e => setColabUrl(e.target.value)}
              className="font-mono text-xs bg-background h-9"
            />
            <Button size="sm" onClick={handlePing} disabled={pingMutation.isPending} className="h-9 px-3">
              {pingMutation.isPending ? <TerminalIcon className="w-4 h-4 animate-pulse" /> : "PING"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <Label className="text-xs font-mono font-bold tracking-widest text-foreground uppercase flex items-center gap-2">
              <Settings2Icon className="w-4 h-4" /> Task Setup
            </Label>
            
            <Select value={taskType} onValueChange={(v: any) => { setTaskType(v); setMode('auto'); }}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_generation">Text Generation</SelectItem>
                <SelectItem value="system_prompt">System Prompting</SelectItem>
                <SelectItem value="model_comparison">Model Comparison</SelectItem>
                <SelectItem value="custom_code">Custom Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono font-bold tracking-widest text-foreground uppercase flex items-center gap-2">
                <DatabaseIcon className="w-4 h-4" /> Model Config
              </Label>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={mode === 'auto' ? 'text-primary font-bold' : 'text-muted-foreground'}>AUTO</span>
                <Switch 
                  checked={mode === 'manual'} 
                  onCheckedChange={(c) => setMode(c ? 'manual' : 'auto')}
                />
                <span className={mode === 'manual' ? 'text-primary font-bold' : 'text-muted-foreground'}>MANUAL</span>
              </div>
            </div>

            {mode === 'manual' && (
              <div className="space-y-3 p-3 bg-muted/30 border border-border rounded-md">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="w-full text-xs font-mono h-8" onClick={handleLoadModels} disabled={fetchModelsMutation.isPending}>
                    {fetchModelsMutation.isPending ? "LOADING..." : "FETCH FREE MODELS"}
                  </Button>
                </div>
                
                {taskType === 'model_comparison' ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto bg-background p-2 border border-border rounded">
                    {modelsList.map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`model-${m.id}`} 
                          checked={selectedModels.includes(m.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedModels([...selectedModels, m.id]);
                            else setSelectedModels(selectedModels.filter(id => id !== m.id));
                          }}
                        />
                        <Label htmlFor={`model-${m.id}`} className="font-mono text-[10px] cursor-pointer truncate flex-1">
                          {m.name || m.id}
                        </Label>
                      </div>
                    ))}
                    {modelsList.length === 0 && <div className="text-xs text-muted-foreground italic">No models loaded.</div>}
                  </div>
                ) : (
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="font-mono text-xs h-9">
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {modelsList.map(m => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-[10px]">
                          {m.name || m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {activeModelInfo && taskType !== 'model_comparison' && (
                  <div className="bg-background border border-border rounded p-3 text-xs font-mono space-y-2 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-primary break-all pr-2">{activeModelInfo.id}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-0">FREE</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>CTX: <span className="text-foreground">{activeModelInfo.contextLength}</span></div>
                      <div>PROV: <span className="text-foreground truncate">{activeModelInfo.topProvider || 'Unknown'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            
            {taskType === 'system_prompt' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">System Prompt</Label>
                <Textarea 
                  className="font-mono text-xs min-h-[80px] resize-none" 
                  placeholder="You are a helpful assistant..."
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                />
              </div>
            )}

            {taskType === 'custom_code' ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Custom Code (Python)</Label>
                <Textarea 
                  className="font-mono text-xs min-h-[160px] resize-none bg-black text-green-400 p-3 rounded-md border-border" 
                  placeholder="# Run custom logic in Colab&#10;def run():&#10;  pass"
                  value={customCode}
                  onChange={e => setCustomCode(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Prompt</Label>
                <Textarea 
                  className="font-mono text-xs min-h-[120px] resize-none border-primary/50 focus-visible:ring-primary/50" 
                  placeholder="Enter your prompt..."
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs text-muted-foreground">Temp</Label>
                  <span className="text-xs font-mono text-foreground">{temperature.toFixed(2)}</span>
                </div>
                <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} max={2} step={0.01} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-xs text-muted-foreground">Tokens</Label>
                  <span className="text-xs font-mono text-foreground">{maxTokens}</span>
                </div>
                <Slider value={[maxTokens]} onValueChange={([v]) => setMaxTokens(v)} min={10} max={4096} step={10} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card">
          <Button 
            className="w-full font-mono font-bold tracking-wide h-12 shadow-md hover:shadow-lg transition-all" 
            onClick={handleRun}
            disabled={runMutation.isPending || !colabUrl}
          >
            {runMutation.isPending ? (
              <span className="flex items-center gap-2"><CpuIcon className="w-5 h-5 animate-spin" /> EXECUTING...</span>
            ) : (
              <span className="flex items-center gap-2"><PlayIcon className="w-5 h-5" /> INITIALIZE_RUN</span>
            )}
          </Button>
        </div>
      </div>

      {/* RIGHT PANEL - RESULTS */}
      <div className="flex-1 bg-muted/10 flex flex-col h-full overflow-hidden relative">
        <div className="h-14 border-b border-border bg-card flex items-center px-6 justify-between flex-shrink-0">
          <h2 className="font-mono font-bold text-sm tracking-widest text-foreground">OUTPUT_TERMINAL</h2>
          {experimentResult && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={() => setShowCode(!showCode)}>
                <Code2Icon className="w-3.5 h-3.5 mr-2" />
                {showCode ? 'HIDE_CODE' : 'GEN_CODE'}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={handleDownloadTxt}>
                <DownloadIcon className="w-3.5 h-3.5 mr-2" />
                DL_TXT
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!experimentResult && !runMutation.isPending ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <TerminalIcon className="w-16 h-16 mb-4 stroke-[1]" />
              <p className="font-mono text-sm tracking-widest">AWAITING_INPUT</p>
            </div>
          ) : runMutation.isPending ? (
            <div className="h-full flex flex-col items-center justify-center text-primary">
              <CpuIcon className="w-16 h-16 mb-4 animate-pulse" />
              <p className="font-mono text-sm tracking-widest animate-pulse">PROCESSING_REQUEST...</p>
            </div>
          ) : experimentResult ? (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* STATUS BANNER */}
              {experimentResult.status === 'error' ? (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-md font-mono text-sm flex items-start gap-3">
                  <AlertCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold mb-1">EXECUTION ERROR</div>
                    <div className="opacity-80 break-words">{experimentResult.error}</div>
                  </div>
                </div>
              ) : null}

              {/* MODEL CARD */}
              {experimentResult.modelCard && (
                <div className="bg-card border-2 border-border rounded-lg p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wider">Target Model</div>
                      <h3 className="text-lg font-bold text-foreground font-mono">{experimentResult.modelCard.name || experimentResult.modelCard.id}</h3>
                    </div>
                    <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20">$0.00 FREE</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground mb-1">PROVIDER</div>
                      <div className="font-medium truncate">{experimentResult.modelCard.topProvider || 'Unknown'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-mono text-muted-foreground mb-1">CONTEXT</div>
                      <div className="font-medium font-mono">{experimentResult.modelCard.contextLength?.toLocaleString() || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-mono text-muted-foreground mb-1">RATING</div>
                      <div className="font-medium font-mono">{experimentResult.modelCard.averageRating ? `${(experimentResult.modelCard.averageRating * 100).toFixed(1)}%` : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* METRICS */}
              {experimentResult.metrics && (
                <div className="flex gap-4 p-4 bg-muted/30 border border-border rounded-lg font-mono text-xs">
                  <div className="flex-1">
                    <div className="text-muted-foreground mb-1 uppercase">Prompt Tokens</div>
                    <div className="text-lg text-foreground">{experimentResult.metrics.promptTokens}</div>
                  </div>
                  <div className="w-px bg-border"></div>
                  <div className="flex-1">
                    <div className="text-muted-foreground mb-1 uppercase">Comp. Tokens</div>
                    <div className="text-lg text-foreground">{experimentResult.metrics.completionTokens}</div>
                  </div>
                  <div className="w-px bg-border"></div>
                  <div className="flex-1">
                    <div className="text-muted-foreground mb-1 uppercase">Total Tokens</div>
                    <div className="text-lg text-foreground font-bold">{experimentResult.metrics.totalTokens}</div>
                  </div>
                  <div className="w-px bg-border"></div>
                  <div className="flex-1">
                    <div className="text-muted-foreground mb-1 uppercase">Exec. Time</div>
                    <div className="text-lg text-primary">{experimentResult.metrics.executionTime.toFixed(2)}s</div>
                  </div>
                </div>
              )}

              {/* RESPONSE PAYLOAD */}
              {experimentResult.result && experimentResult.taskType !== 'model_comparison' && (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-muted/50 border-b border-border px-4 py-2 font-mono text-xs font-bold text-muted-foreground">
                    RESPONSE_PAYLOAD
                  </div>
                  <div className="p-6 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {experimentResult.result}
                  </div>
                </div>
              )}
              
              {/* COMPARISONS */}
              {experimentResult.comparisons && experimentResult.comparisons.length > 0 && (
                <div className="space-y-4">
                  <div className="bg-muted/50 border-b border-border px-4 py-2 font-mono text-xs font-bold text-muted-foreground">
                    COMPARISON_RESULTS
                  </div>
                  {experimentResult.comparisons.map(c => (
                    <div key={c.modelId} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                      <div className="bg-muted/30 border-b border-border px-4 py-2 flex justify-between items-center">
                        <span className="font-mono text-xs font-bold text-primary">{c.modelId}</span>
                        {c.metrics && <span className="font-mono text-[10px] text-muted-foreground">{c.metrics.totalTokens} tk | {c.metrics.executionTime.toFixed(2)}s</span>}
                      </div>
                      <div className="p-4 whitespace-pre-wrap font-sans text-sm text-foreground">
                        {c.error ? <span className="text-destructive">{c.error}</span> : c.result}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CODE GENERATION */}
              {showCode && (
                <div className="bg-[#1e1e1e] border border-border rounded-lg shadow-sm overflow-hidden mt-6 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-black/40 border-b border-white/10 px-4 py-2 flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-white/50">colab_script.py</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => {
                        navigator.clipboard.writeText(generatePythonCode());
                        toast({ title: "Copied to clipboard" });
                      }}
                    >
                      COPY
                    </Button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="font-mono text-xs leading-relaxed text-gray-300">
                      <code>{generatePythonCode()}</code>
                    </pre>
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
