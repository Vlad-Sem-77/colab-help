import { useState } from "react";
import { ArrowDown, Check, ChevronDown, CirclePlay, Code2, FileText, LockKeyhole, Settings2, Waves } from "lucide-react";
import "./_group.css";

type Values = {
  prompt: string;
  temperature: number;
  max_tokens: number;
  task_type: string;
};

const initialValues: Values = {
  prompt: "Объясни, как работает градиентный спуск.",
  temperature: 0.7,
  max_tokens: 1024,
  task_type: "text_generation",
};

const taskTypes = ["text_generation", "model_comparison", "system_prompt", "custom_code"];
const protectedCode = `messages = [
    {"role": "user", "content": prompt}
]

response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=temperature,
    max_tokens=max_tokens,
)`;

type CellId = "markdown" | "parameters" | "code";

function CellSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? "включена" : "пропущена"}`}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[25px] w-[44px] shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#679b8d] focus-visible:ring-offset-2 ${
        checked ? "border-[#638f82] bg-[#779f92]" : "border-[#d2d9d1] bg-[#e5e9e3]"
      }`}
    >
      <span
        className={`absolute left-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#fffefa] shadow-[0_1px_3px_rgba(49,71,62,.22)] transition-transform duration-200 ${
          checked ? "translate-x-[19px]" : "translate-x-0"
        }`}
      >
        {checked && <Check className="h-[10px] w-[10px] text-[#537d71]" strokeWidth={3} />}
      </span>
    </button>
  );
}

function CellTop({
  index,
  kind,
  title,
  active,
  onToggle,
  onRun,
  runLabel,
}: {
  index: string;
  kind: "markdown" | "parameters" | "code";
  title: string;
  active: boolean;
  onToggle: (active: boolean) => void;
  onRun?: () => void;
  runLabel?: string;
}) {
  const Icon = kind === "markdown" ? FileText : kind === "parameters" ? Settings2 : Code2;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[#e8ebe4] px-5 py-[15px] sm:px-7">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] tracking-[.08em] text-[#91a09a]">{index}</span>
        <span
          className={`flex h-8 items-center gap-2 rounded-full px-3 text-[11px] font-semibold tracking-[.01em] ${
            kind === "markdown"
              ? "bg-[#f0f3ed] text-[#637c70]"
              : kind === "parameters"
                ? "bg-[#fbf1e5] text-[#a17445]"
                : "bg-[#eaf1f0] text-[#547b7a]"
          }`}
        >
          <Icon className="h-[14px] w-[14px]" strokeWidth={1.8} />
          {title}
        </span>
        {!active && (
          <span className="rounded-full bg-[#f0f1ee] px-2.5 py-1 text-[10px] font-medium text-[#89928d]">
            Пропущена
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            disabled={!active}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[#d9e4dd] bg-[#f7faf6] px-4 text-[12px] font-semibold text-[#456e61] transition hover:border-[#a9c4b7] hover:bg-[#edf5ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CirclePlay className="h-[15px] w-[15px]" />
            {runLabel ?? "Run"}
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${active ? "text-[#7c8982]" : "text-[#a5aca7]"}`}>
            {active ? "В потоке" : "Пропустить"}
          </span>
          <CellSwitch label={`Ячейка ${index}`} checked={active} onChange={onToggle} />
        </div>
      </div>
    </div>
  );
}

export function LightWaves() {
  const [values, setValues] = useState<Values>(initialValues);
  const [activeCells, setActiveCells] = useState<Record<CellId, boolean>>({
    markdown: true,
    parameters: true,
    code: true,
  });
  const [runNotice, setRunNotice] = useState("");

  const setActive = (id: CellId, active: boolean) => {
    setActiveCells((current) => ({ ...current, [id]: active }));
  };
  const updateValue = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const runLocally = (cell: "parameters" | "code") => {
    if (!activeCells[cell]) return;
    setRunNotice(
      cell === "code"
        ? "Макет · ячейка проверена локально"
        : "Макет · параметры готовы к запуску",
    );
  };

  return (
    <main className="light-waves min-h-[100dvh] px-4 py-7 text-[#34433f] sm:px-7 sm:py-10 lg:px-10">
      <style>{`
        .light-waves {
          background:
            radial-gradient(ellipse at 84% 4%, rgba(224, 237, 225, .66), transparent 33rem),
            #f4f6f1;
          font-family: "DM Sans", "Avenir Next", sans-serif;
        }
        .light-waves * { box-sizing: border-box; }
        .light-waves .lw-enter { animation: lw-rise .65s cubic-bezier(.2,.75,.25,1) both; }
        .light-waves .lw-delay-1 { animation-delay: .08s; }
        .light-waves .lw-delay-2 { animation-delay: .16s; }
        .light-waves .lw-delay-3 { animation-delay: .24s; }
        @keyframes lw-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
        .light-waves input[type="range"] { accent-color: #739a8b; }
        .light-waves select:disabled, .light-waves textarea:disabled, .light-waves input:disabled { cursor: not-allowed; }
        @media (prefers-reduced-motion: reduce) {
          .light-waves .lw-enter { animation: none; }
          .light-waves * { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[1080px]">
        <header className="lw-enter mb-9 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium tracking-[.12em] text-[#87958d]">
              <span>NOTEBOOKS</span>
              <span className="text-[#bdc9c0]">/</span>
              <span className="text-[#5f7d70]">COLAB READER</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1 hidden h-12 w-12 items-center justify-center rounded-[17px] bg-[#e4ede4] text-[#648579] sm:flex">
                <Waves className="h-6 w-6" strokeWidth={1.6} />
              </div>
              <div>
                <h1 className="font-['DM_Sans'] text-[29px] font-semibold leading-tight tracking-[-.045em] text-[#33443d] sm:text-[35px]">
                  Text generation
                </h1>
                <p className="mt-2 max-w-lg text-[13px] leading-6 text-[#839089]">
                  A quiet, read-only path from request to response.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e0e6de] bg-[#fafbf8] px-4 text-[11px] text-[#708079]">
              <LockKeyhole className="h-[14px] w-[14px] text-[#789689]" />
              Protected code
            </div>
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e0e6de] bg-[#fafbf8] px-4 text-[11px] text-[#708079]">
              3 cells <span className="text-[#b7c1b9]">·</span> saved output
            </div>
          </div>
        </header>

        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-[20px] top-[35px] z-0 hidden h-[calc(100%-70px)] w-[68px] overflow-visible lg:block"
            viewBox="0 0 68 1000"
            preserveAspectRatio="none"
          >
            <path
              d="M34 0 C 34 50, 9 50, 9 105 S 59 170, 34 225 S 9 300, 9 355 S 59 425, 34 480 S 9 550, 9 605 S 59 680, 34 735 S 9 820, 9 875 S 59 950, 34 1000"
              fill="none"
              stroke="#c9d9cd"
              strokeDasharray="2 8"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>

          <section
            className={`lw-enter lw-delay-1 relative z-[1] mb-5 overflow-hidden rounded-[25px] border border-[#e3e9e1] bg-[#fffefa] shadow-[0_5px_20px_rgba(61,80,67,.035)] transition-opacity ${
              activeCells.markdown ? "" : "opacity-60"
            }`}
          >
            <CellTop
              index="01"
              kind="markdown"
              title="Markdown"
              active={activeCells.markdown}
              onToggle={(checked) => setActive("markdown", checked)}
            />
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <p className="max-w-2xl text-[14px] leading-7 text-[#75847c]">
                Set the request parameters, then run the protected notebook cell.
              </p>
            </div>
          </section>

          <section
            className={`lw-enter lw-delay-2 relative z-[1] mb-5 overflow-hidden rounded-[25px] border border-[#e3e9e1] bg-[#fffefa] shadow-[0_5px_20px_rgba(61,80,67,.035)] transition-opacity ${
              activeCells.parameters ? "" : "opacity-60"
            }`}
          >
            <CellTop
              index="02"
              kind="parameters"
              title="Parameters"
              active={activeCells.parameters}
              onToggle={(checked) => setActive("parameters", checked)}
              onRun={() => runLocally("parameters")}
              runLabel="Check parameters"
            />
            <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_.88fr] lg:gap-10 lg:px-8">
              <fieldset disabled={!activeCells.parameters} className="min-w-0 space-y-6 disabled:pointer-events-none">
                <label className="block space-y-2">
                  <span className="flex items-center justify-between font-mono text-[11px] font-medium text-[#829089]">
                    <span>prompt</span>
                    <span className="font-sans text-[10px] font-normal text-[#aab4ac]">request text</span>
                  </span>
                  <textarea
                    value={values.prompt}
                    onChange={(event) => updateValue("prompt", event.target.value)}
                    rows={3}
                    className="min-h-[94px] w-full resize-y rounded-[15px] border border-[#e1e7df] bg-[#fbfcf9] px-4 py-3 font-mono text-[12px] leading-6 text-[#52645a] outline-none transition focus:border-[#a9c4b4] focus:ring-2 focus:ring-[#e8f0e8]"
                  />
                </label>

                <label className="block space-y-2.5">
                  <span className="flex items-center justify-between font-mono text-[11px] font-medium text-[#829089]">
                    <span>temperature</span>
                    <span className="rounded-md bg-[#f0f4ef] px-2 py-1 text-[11px] text-[#55786a]">{values.temperature.toFixed(2)}</span>
                  </span>
                  <input
                    aria-label="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={values.temperature}
                    onChange={(event) => updateValue("temperature", Number(event.target.value))}
                    className="h-2 w-full cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#aab4ad]"><span>0.00</span><span>2.00</span></div>
                </label>

                <label className="block space-y-2.5">
                  <span className="flex items-center justify-between font-mono text-[11px] font-medium text-[#829089]">
                    <span>max_tokens</span>
                    <span className="rounded-md bg-[#f0f4ef] px-2 py-1 text-[11px] text-[#55786a]">{values.max_tokens}</span>
                  </span>
                  <input
                    aria-label="max_tokens"
                    type="range"
                    min="64"
                    max="4096"
                    step="64"
                    value={values.max_tokens}
                    onChange={(event) => updateValue("max_tokens", Number(event.target.value))}
                    className="h-2 w-full cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#aab4ad]"><span>64</span><span>4096</span></div>
                </label>

                <label className="block space-y-2">
                  <span className="font-mono text-[11px] font-medium text-[#829089]">task_type</span>
                  <span className="relative block">
                    <select
                      value={values.task_type}
                      onChange={(event) => updateValue("task_type", event.target.value)}
                      className="h-11 w-full appearance-none rounded-[13px] border border-[#e1e7df] bg-[#fbfcf9] px-4 pr-10 font-mono text-[11px] text-[#52645a] outline-none focus:border-[#a9c4b4] focus:ring-2 focus:ring-[#e8f0e8]"
                    >
                      {taskTypes.map((task) => <option key={task} value={task}>{task}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91a097]" />
                  </span>
                </label>
              </fieldset>

              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#8a978f]">
                    <Code2 className="h-[14px] w-[14px]" />
                    Live parameter preview
                  </div>
                  <span className="rounded-full bg-[#f5f1e9] px-2.5 py-1 text-[9px] tracking-[.05em] text-[#a38c6b]">READ ONLY</span>
                </div>
                <pre className="min-h-[277px] overflow-x-auto rounded-[18px] border border-[#ecece2] bg-[#f8f8f2] p-4 font-mono text-[11px] leading-[1.95] text-[#68786c] sm:p-5"><code>{`prompt = ${JSON.stringify(values.prompt)}
temperature = ${values.temperature}
max_tokens = ${values.max_tokens}
task_type = ${JSON.stringify(values.task_type)}`}</code></pre>
                <p className="mt-3 flex items-center gap-2 text-[10px] leading-5 text-[#a0aaa2]">
                  <LockKeyhole className="h-3 w-3 shrink-0" />
                  Only the controls above can change these values.
                </p>
              </div>
            </div>
          </section>

          <section
            className={`lw-enter lw-delay-3 relative z-[1] overflow-hidden rounded-[25px] border border-[#e3e9e1] bg-[#fffefa] shadow-[0_5px_20px_rgba(61,80,67,.035)] transition-opacity ${
              activeCells.code ? "" : "opacity-60"
            }`}
          >
            <CellTop
              index="03"
              kind="code"
              title="Code"
              active={activeCells.code}
              onToggle={(checked) => setActive("code", checked)}
              onRun={() => runLocally("code")}
              runLabel="Run cell"
            />
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-medium text-[#8a978f]">
                  <LockKeyhole className="h-[13px] w-[13px]" />
                  Protected Python cell
                </span>
                <span className="font-mono text-[10px] text-[#b0bab1]">python</span>
              </div>
              <pre className="overflow-x-auto rounded-[18px] border border-[#e6ebe5] bg-[#f6f8f5] p-4 font-mono text-[11px] leading-[1.9] text-[#60796f] sm:p-5 sm:text-[12px]"><code>{protectedCode}</code></pre>
            </div>
            <div className="border-t border-[#e9ece5] bg-[#f8faf6] px-5 py-5 sm:px-7 sm:py-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-[#71847a]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e8f0e8] text-[#718f7d]"><Check className="h-3 w-3" /></span>
                  Saved result
                </div>
                {runNotice && activeCells.code && (
                  <span role="status" className="text-[10px] text-[#829a87]">{runNotice}</span>
                )}
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-6 text-[#638272]">
                Gradient descent updates the model parameters to reduce the loss.
              </pre>
            </div>
          </section>

          <footer className="flex items-center justify-center gap-2 py-7 text-[10px] tracking-[.02em] text-[#9ba79f]">
            <ArrowDown className="h-3 w-3" />
            Follow the cells from request to result
          </footer>
        </div>
      </div>
    </main>
  );
}
