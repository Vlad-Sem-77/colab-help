import { useState } from "react";
import { Code, Download, FileText, Play, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import "./_group.css";

type Parameter = {
  varName: string;
  varType: "string" | "number" | "bool";
  defaultValue: string | number | boolean;
};

const parameters: Parameter[] = [
  { varName: "prompt", varType: "string", defaultValue: "Объясни, как работает градиентный спуск." },
  { varName: "temperature", varType: "number", defaultValue: 0.7 },
  { varName: "max_tokens", varType: "number", defaultValue: 1024 },
  { varName: "task_type", varType: "string", defaultValue: "text_generation" },
];

const code = `messages = [
    {"role": "user", "content": prompt}
]

response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=temperature,
    max_tokens=max_tokens,
)`;

function CellHeader({
  index,
  type,
  onRun,
}: {
  index: number;
  type: "markdown" | "parameter" | "code";
  onRun?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">[{index}]</span>
        {type === "markdown" && (
          <Badge variant="secondary" className="bg-gray-800 text-gray-300">
            <FileText className="mr-1 h-3 w-3" /> Markdown
          </Badge>
        )}
        {type === "parameter" && (
          <Badge variant="secondary" className="bg-orange-950 text-orange-300">
            <Settings2 className="mr-1 h-3 w-3" /> Parameters
          </Badge>
        )}
        {type === "code" && (
          <Badge variant="secondary" className="bg-blue-950 text-blue-300">
            <Code className="mr-1 h-3 w-3" /> Code
          </Badge>
        )}
      </div>
      {onRun && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRun}>
          <Play className="mr-1 h-3 w-3" /> Run
        </Button>
      )}
    </div>
  );
}

function ParameterWidget({
  param,
  value,
  onChange,
}: {
  param: Parameter;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const isPrompt = param.varName.includes("prompt");
  const isTemp = param.varName === "temperature";
  const isTokens = param.varName === "max_tokens" || param.varName === "max_length";
  const isTask = param.varName === "task_type";

  if (isPrompt) {
    return (
      <div className="space-y-1.5">
        <label className="font-mono text-xs font-medium text-muted-foreground">{param.varName}</label>
        <Textarea
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[88px] font-mono text-sm"
        />
      </div>
    );
  }

  if (isTemp || isTokens) {
    const min = isTemp ? 0 : 64;
    const max = isTemp ? 2 : 4096;
    const step = isTemp ? 0.01 : 64;
    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="font-mono text-xs font-medium text-muted-foreground">{param.varName}</label>
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[Number(value)]}
          onValueChange={(next) => onChange(next[0])}
        />
      </div>
    );
  }

  if (param.varType === "bool") {
    return (
      <div className="flex items-center justify-between py-1">
        <label className="font-mono text-xs font-medium text-muted-foreground">{param.varName}</label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (isTask) {
    return (
      <div className="space-y-1.5">
        <label className="font-mono text-xs font-medium text-muted-foreground">{param.varName}</label>
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
      <label className="font-mono text-xs font-medium text-muted-foreground">{param.varName}</label>
      <Input value={String(value)} onChange={(event) => onChange(event.target.value)} className="font-mono text-sm" />
    </div>
  );
}

export function Current() {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(
    Object.fromEntries(parameters.map((param) => [param.varName, param.defaultValue])),
  );
  const updateValue = (varName: string, value: string | number | boolean) => {
    setValues((current) => ({ ...current, [varName]: value }));
  };

  return (
    <main className="dark min-h-screen bg-background px-8 py-7 font-sans text-foreground">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Notebook / Colab</p>
            <h1 className="text-lg font-semibold">Text generation</h1>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </header>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <CellHeader index={1} type="markdown" />
          <div className="px-5 py-4 text-sm text-muted-foreground">
            Set the request parameters, then run the protected notebook cell.
          </div>
        </section>

        <section className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="w-1 shrink-0 bg-orange-500/80" />
          <div className="min-w-0 flex-1">
            <CellHeader index={2} type="parameter" onRun={() => undefined} />
            <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
              <div className="space-y-4">
                {parameters.map((param) => (
                  <ParameterWidget
                    key={param.varName}
                    param={param}
                    value={values[param.varName]}
                    onChange={(value) => updateValue(param.varName, value)}
                  />
                ))}
              </div>
              <div className="overflow-x-auto rounded bg-muted/50 p-4 font-mono text-xs text-orange-100">
                <pre className="whitespace-pre-wrap">{`prompt = ${JSON.stringify(values.prompt)}
temperature = ${values.temperature}
max_tokens = ${values.max_tokens}
task_type = ${JSON.stringify(values.task_type)}`}</pre>
              </div>
            </div>
          </div>
        </section>

        <section className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="w-1 shrink-0 bg-blue-500/80" />
          <div className="min-w-0 flex-1">
            <CellHeader index={3} type="code" onRun={() => undefined} />
            <div className="p-4">
              <pre className="overflow-x-auto rounded bg-muted/50 p-4 font-mono text-sm text-blue-100">
                <code>{code}</code>
              </pre>
            </div>
            <div className="border-t border-border bg-black/50 p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-green-400">
                Gradient descent updates the model parameters to reduce the loss.
              </pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
