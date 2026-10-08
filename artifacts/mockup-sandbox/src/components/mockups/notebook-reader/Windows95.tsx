import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  Download,
  FileText,
  Play,
  Power,
  Settings2,
  SkipForward,
} from "lucide-react";
import "./_group.css";

type ParamValues = {
  prompt: string;
  temperature: number;
  max_tokens: number;
  task_type: string;
};

const code = `messages = [
    {"role": "user", "content": prompt}
]

response = client.chat.completions.create(
    model=model,
    messages=messages,
    temperature=temperature,
    max_tokens=max_tokens,
)`;

const initialValues: ParamValues = {
  prompt: "Объясни, как работает градиентный спуск.",
  temperature: 0.7,
  max_tokens: 1024,
  task_type: "text_generation",
};

function BevelButton({
  children,
  onClick,
  disabled = false,
  primary = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`win95-button ${primary ? "win95-primary" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

function CellToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onChange}
      className={`win95-toggle ${active ? "is-on" : ""}`}
      title={active ? "Отключить ячейку" : "Включить ячейку"}
    >
      <span className="win95-toggle-box">{active && <Check size={10} strokeWidth={3} />}</span>
      <span>{active ? "Активна" : "Пропустить"}</span>
    </button>
  );
}

function CellFrame({
  index,
  kind,
  title,
  active,
  onToggle,
  children,
  action,
  muted = false,
}: {
  index: string;
  kind: "doc" | "parameters" | "code";
  title: string;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: React.ReactNode;
  muted?: boolean;
}) {
  const Glyph = kind === "doc" ? FileText : kind === "parameters" ? Settings2 : Code2;
  return (
    <section className={`win95-cell ${muted ? "cell-muted" : ""}`}>
      <div className="win95-cell-head">
        <div className="win95-cell-title">
          <span className="win95-cell-index">[{index}]</span>
          <span className={`win95-kind kind-${kind}`}>
            <Glyph size={12} />
            {title}
          </span>
          {!active && <span className="win95-skipped"><SkipForward size={10} /> ПРОПУЩЕНА</span>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <CellToggle active={active} onChange={onToggle} />
        </div>
      </div>
      <div className="win95-cell-body">{children}</div>
    </section>
  );
}

export function Windows95() {
  const [values, setValues] = useState<ParamValues>(initialValues);
  const [active, setActive] = useState({ intro: true, params: true, code: true });
  const [runMessage, setRunMessage] = useState("Результат сохранён · 14:32:08");

  const update = <K extends keyof ParamValues>(key: K, value: ParamValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const toggle = (key: keyof typeof active) =>
    setActive((current) => ({ ...current, [key]: !current[key] }));
  const exportNotebook = () => {
    const payload = {
      cells: [
        { cell_type: "markdown", source: "Set the request parameters, then run the protected notebook cell." },
        { cell_type: "parameter", source: values },
        { cell_type: "code", source: code, outputs: ["Gradient descent updates the model parameters to reduce the loss."] },
      ],
    };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    link.download = "text-generation-notebook.ipynb";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const markRun = (which: string) => setRunMessage(`Макетный запуск: ${which} · сохранённый результат не изменён`);

  return (
    <main className="win95-root min-h-[100dvh]">
      <style>{`
        .win95-root {
          --desk: #c0c0c0; --panel: #c6c6c6; --ink: #202020; --muted-ink: #565656;
          --navy: #000080; --edge-light: #ffffff; --edge-mid: #dfdfdf; --edge-dark: #808080; --edge-deep: #404040;
          min-height: 100dvh; padding: 18px; color: var(--ink); background: #b9b9b9;
          font-family: Tahoma, "MS Sans Serif", sans-serif; font-size: 12px;
          background-image: radial-gradient(#a8a8a8 0.55px, transparent 0.55px); background-size: 4px 4px;
        }
        .win95-shell { max-width: 1120px; margin: 0 auto; border: 1px solid var(--edge-deep); background: var(--panel); box-shadow: 1px 1px 0 #fff inset, -1px -1px 0 #777 inset, 3px 4px 0 rgba(0,0,0,.18); }
        .win95-titlebar { min-height: 32px; padding: 4px 6px 4px 9px; display:flex; align-items:center; justify-content:space-between; color:#fff; background: linear-gradient(90deg,#000080,#1084d0); font-weight:700; letter-spacing:.01em; }
        .win95-titlebar-label {display:flex; align-items:center; gap:8px}
        .win95-window-controls {display:flex; gap:3px}
        .win95-window-controls span {width:20px;height:19px;background:#c6c6c6;color:#111;display:grid;place-items:center;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;font-size:11px;line-height:1}
        .win95-menubar { display:flex; gap:0; padding:2px 5px; border-bottom:1px solid #888; background:#c6c6c6; color:#222; }
        .win95-menubar span {padding:3px 9px}
        .win95-toolbar {display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #888;box-shadow:0 1px #fff;background:#c6c6c6}
        .win95-doc-id {display:flex;align-items:center;gap:9px;min-width:0}
        .win95-doc-icon {width:28px;height:28px;display:grid;place-items:center;background:#e7e7e7;border:1px solid #777;box-shadow:1px 1px #fff inset,-1px -1px #999 inset}
        .win95-doc-title {font-weight:700;font-size:13px;white-space:nowrap}
        .win95-doc-meta {color:#555;font-family:"Courier New",monospace;font-size:10px;margin-top:2px}
        .win95-workspace {display:grid;grid-template-columns:176px minmax(0,1fr);gap:10px;padding:10px;align-items:start}
        .win95-sidebar {border:1px solid #777;box-shadow:1px 1px #fff inset,-1px -1px #999 inset;background:#d0d0d0;padding:7px}
        .win95-side-label {font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#4d4d4d;padding:3px 5px 7px}
        .win95-nav-item {display:flex;align-items:center;gap:7px;padding:6px 5px;color:#333;border:1px solid transparent}
        .win95-nav-item.current {background:#000080;color:#fff;border:1px solid #00006a}
        .win95-side-rule {border:0;border-top:1px solid #888;border-bottom:1px solid #fff;margin:8px 0}
        .win95-side-stat {padding:2px 5px;color:#444;font-family:"Courier New",monospace;font-size:10px;line-height:1.8}
        .win95-cell-list {display:flex;flex-direction:column;gap:8px;min-width:0}
        .win95-cell {border:1px solid #858585;background:#dedede;box-shadow:1px 1px #fff inset,-1px -1px #a1a1a1 inset;transition:opacity .16s ease}
        .win95-cell.cell-muted {opacity:.48;filter:grayscale(.75)}
        .win95-cell-head {min-height:34px;padding:5px 7px;background:#c4c4c4;border-bottom:1px solid #858585;box-shadow:0 1px #f2f2f2;display:flex;justify-content:space-between;align-items:center;gap:8px}
        .win95-cell-title {display:flex;align-items:center;gap:8px;min-width:0}
        .win95-cell-index {font-family:"Courier New",monospace;color:#333;font-size:11px}
        .win95-kind {height:19px;padding:0 6px;display:inline-flex;gap:4px;align-items:center;border:1px solid #909090;background:#ededed;font-size:10px;font-weight:700}
        .kind-doc {color:#343434}.kind-parameters {color:#714500;background:#f1e5d1}.kind-code {color:#153e69;background:#dce8f3}
        .win95-skipped {display:inline-flex;align-items:center;gap:3px;border:1px solid #8a5353;background:#f0d9d9;color:#782d2d;padding:2px 5px;font-family:"Courier New",monospace;font-size:9px;font-weight:700}
        .win95-toggle {display:inline-flex;align-items:center;gap:5px;padding:2px 4px;background:transparent;border:1px solid transparent;font-size:10px;color:#333;cursor:pointer;white-space:nowrap}
        .win95-toggle:hover {border-color:#888;background:#d4d4d4}
        .win95-toggle-box {width:13px;height:13px;background:#fff;border:1px solid #555;box-shadow:1px 1px #aaa inset;display:grid;place-items:center;color:#111}
        .win95-cell-body {padding:9px 11px}
        .win95-copy {font-size:12px;line-height:1.55;color:#383838;margin:0}
        .win95-md-heading {font-size:14px;font-weight:700;margin:0 0 3px}
        .win95-field-label {display:block;margin-bottom:4px;font-family:"Courier New",monospace;font-size:11px;font-weight:700;color:#333}
        .win95-input {width:100%;border:1px solid #777;border-top-color:#444;border-left-color:#444;background:#fff;padding:6px 7px;color:#222;font:12px "Courier New",monospace;outline:none;box-shadow:1px 1px 0 #ddd inset;resize:vertical}
        .win95-input:focus {outline:1px dotted #111;outline-offset:-3px}
        .win95-control-grid {display:grid;grid-template-columns:minmax(0,1.2fr) minmax(210px,.8fr);gap:12px}
        .win95-controls {display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
        .win95-param {min-width:0}.win95-param.prompt-param {grid-column:1/-1}
        .win95-range-head {display:flex;justify-content:space-between;gap:6px;align-items:center;margin-bottom:7px}
        .win95-value {font-family:"Courier New",monospace;font-size:11px;background:#fff;border:1px solid #999;padding:1px 4px;min-width:46px;text-align:right}
        .win95-range {width:100%;height:16px;appearance:none;background:transparent;cursor:pointer}
        .win95-range::-webkit-slider-runnable-track {height:5px;background:#969696;border:1px solid #777;box-shadow:1px 1px #eee inset}
        .win95-range::-webkit-slider-thumb {appearance:none;width:13px;height:19px;margin-top:-8px;background:#c6c6c6;border-top:2px solid #fff;border-left:2px solid #fff;border-right:2px solid #555;border-bottom:2px solid #555}
        .win95-range::-moz-range-track {height:4px;background:#969696;border:1px solid #777}
        .win95-range::-moz-range-thumb {width:10px;height:16px;border-radius:0;background:#c6c6c6;border:2px outset #eee}
        .win95-select-wrap {position:relative}
        .win95-select {width:100%;appearance:none;border:1px solid #777;border-top-color:#444;border-left-color:#444;background:#fff;padding:5px 27px 5px 6px;font:11px "Courier New",monospace;color:#222}
        .win95-select-wrap svg {position:absolute;right:6px;top:7px;pointer-events:none}
        .win95-config {background:#242424;color:#efc47f;border:1px solid #555;padding:8px;font:10px/1.65 "Courier New",monospace;min-width:0;overflow:auto}
        .win95-config-title {color:#bcbcbc;text-transform:uppercase;letter-spacing:.1em;font-size:9px;border-bottom:1px solid #555;padding-bottom:4px;margin-bottom:5px}
        .win95-config-line {white-space:nowrap}
        .win95-code {margin:0;overflow:auto;background:#17212b;color:#d7e3ed;border:1px solid #555;padding:10px;font:11px/1.55 "Courier New",monospace;white-space:pre}
        .code-ln {color:#7790a3;user-select:none}
        .win95-output {margin-top:8px;background:#f4f4f4;border:1px solid #858585;box-shadow:1px 1px #fff inset;padding:8px 9px}
        .win95-output-head {display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px}
        .win95-output-label {display:flex;align-items:center;gap:5px;font:700 10px "Courier New",monospace;color:#333;text-transform:uppercase;letter-spacing:.04em}
        .win95-output-status {font:9px "Courier New",monospace;color:#555}
        .win95-output-text {margin:0;color:#222;font:12px/1.5 "Courier New",monospace;white-space:pre-wrap}
        .win95-button {display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:26px;padding:3px 9px;background:#c6c6c6;border-top:1px solid #fff;border-left:1px solid #fff;border-right:1px solid #555;border-bottom:1px solid #555;color:#222;font-size:11px;cursor:pointer;white-space:nowrap}
        .win95-button:active:not(:disabled) {border-top:1px solid #555;border-left:1px solid #555;border-right:1px solid #fff;border-bottom:1px solid #fff;padding-top:4px;padding-left:10px}
        .win95-button:disabled {color:#888;cursor:not-allowed;text-shadow:1px 1px #fff}
        .win95-button.win95-primary {font-weight:700;outline:1px dotted #222;outline-offset:-4px}
        .win95-statusbar {display:flex;justify-content:space-between;gap:8px;padding:5px 8px;background:#c6c6c6;border-top:1px solid #fff;color:#454545;font:10px "Courier New",monospace}
        .win95-status-segment {border:1px solid #999;border-top-color:#777;border-left-color:#777;padding:2px 6px;min-width:0}
        .win95-toolbar-right {display:flex;align-items:center;gap:6px}
        @media (max-width:740px) {
          .win95-root{padding:8px}.win95-workspace{grid-template-columns:1fr}.win95-sidebar{display:none}
          .win95-control-grid{grid-template-columns:1fr}.win95-controls{grid-template-columns:1fr 1fr}
          .win95-toolbar{align-items:flex-start;flex-direction:column}.win95-toolbar-right{width:100%;justify-content:flex-end}
          .win95-cell-head{align-items:flex-start}.win95-cell-title{flex-wrap:wrap}
        }
        @media (max-width:460px) {
          .win95-cell-head{flex-direction:column;align-items:stretch}.win95-cell-head>.flex{justify-content:space-between}
          .win95-controls{grid-template-columns:1fr}.win95-param.prompt-param{grid-column:auto}
          .win95-statusbar{flex-wrap:wrap}.win95-status-segment:first-child{flex:1}
        }
      `}</style>

      <div className="win95-shell">
        <div className="win95-titlebar">
          <div className="win95-titlebar-label"><Code2 size={15} /><span>Colab Notebook Reader — Text generation</span></div>
          <div className="win95-window-controls" aria-hidden="true"><span>_</span><span>□</span><span>×</span></div>
        </div>
        <nav className="win95-menubar" aria-label="Меню блокнота">
          <span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>R</u>un</span><span><u>H</u>elp</span>
        </nav>
        <header className="win95-toolbar">
          <div className="win95-doc-id">
            <div className="win95-doc-icon"><FileText size={17} /></div>
            <div>
              <div className="win95-doc-title">Text generation</div>
              <div className="win95-doc-meta">NOTEBOOK / COLAB · 3 ЯЧЕЙКИ · ТОЛЬКО ЧТЕНИЕ КОДА</div>
            </div>
          </div>
          <div className="win95-toolbar-right">
            <span className="hidden sm:inline text-[10px] text-[#4a4a4a]">Снимок блокнота · сохранён</span>
            <BevelButton onClick={exportNotebook}><Download size={13} /> Экспорт</BevelButton>
          </div>
        </header>

        <div className="win95-workspace">
          <aside className="win95-sidebar">
            <div className="win95-side-label">Проводник блокнота</div>
            <div className="win95-nav-item current"><FileText size={13} /> Содержимое</div>
            <div className="win95-nav-item"><Settings2 size={13} /> Параметры</div>
            <div className="win95-nav-item"><Code2 size={13} /> Ячейка кода</div>
            <hr className="win95-side-rule" />
            <div className="win95-side-label">Сеанс</div>
            <div className="win95-side-stat">Активных <b>{Object.values(active).filter(Boolean).length} / 3</b></div>
            <div className="win95-side-stat">Изменено <b>локально</b></div>
            <div className="win95-side-stat">Среда <b>макет</b></div>
            <hr className="win95-side-rule" />
            <div className="win95-side-stat leading-snug">Код защищён от редактирования. Меняйте только параметры в выделенных полях.</div>
          </aside>

          <div className="win95-cell-list">
            <CellFrame index="1" kind="doc" title="Markdown" active={active.intro} onToggle={() => toggle("intro")}>
              <h2 className="win95-md-heading">Text generation</h2>
              <p className="win95-copy">Set the request parameters, then run the protected notebook cell.</p>
            </CellFrame>

            <CellFrame
              index="2"
              kind="parameters"
              title="Parameters"
              active={active.params}
              onToggle={() => toggle("params")}
              action={<BevelButton disabled={!active.params} onClick={() => markRun("параметры")}><Play size={12} /> Run</BevelButton>}
            >
              <div className="win95-control-grid">
                <div className="win95-controls">
                  <div className="win95-param prompt-param">
                    <label className="win95-field-label" htmlFor="win95-prompt">prompt</label>
                    <textarea
                      id="win95-prompt"
                      className="win95-input min-h-[56px]"
                      value={values.prompt}
                      disabled={!active.params}
                      onChange={(event) => update("prompt", event.target.value)}
                    />
                  </div>
                  <div className="win95-param">
                    <div className="win95-range-head">
                      <label className="win95-field-label !mb-0" htmlFor="win95-temperature">temperature</label>
                      <span className="win95-value">{values.temperature.toFixed(2)}</span>
                    </div>
                    <input id="win95-temperature" className="win95-range" type="range" min="0" max="2" step="0.01" value={values.temperature} disabled={!active.params} onChange={(event) => update("temperature", Number(event.target.value))} />
                  </div>
                  <div className="win95-param">
                    <div className="win95-range-head">
                      <label className="win95-field-label !mb-0" htmlFor="win95-max-tokens">max_tokens</label>
                      <span className="win95-value">{values.max_tokens}</span>
                    </div>
                    <input id="win95-max-tokens" className="win95-range" type="range" min="64" max="4096" step="64" value={values.max_tokens} disabled={!active.params} onChange={(event) => update("max_tokens", Number(event.target.value))} />
                  </div>
                  <div className="win95-param prompt-param">
                    <label className="win95-field-label" htmlFor="win95-task">task_type</label>
                    <div className="win95-select-wrap">
                      <select id="win95-task" className="win95-select" value={values.task_type} disabled={!active.params} onChange={(event) => update("task_type", event.target.value)}>
                        <option value="text_generation">text_generation</option>
                        <option value="model_comparison">model_comparison</option>
                        <option value="system_prompt">system_prompt</option>
                        <option value="custom_code">custom_code</option>
                      </select>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                </div>
                <div className="win95-config" aria-label="Предпросмотр параметров">
                  <div className="win95-config-title">Текущая конфигурация</div>
                  <div className="win95-config-line">prompt = {JSON.stringify(values.prompt)}</div>
                  <div className="win95-config-line">temperature = {values.temperature.toFixed(2)}</div>
                  <div className="win95-config-line">max_tokens = {values.max_tokens}</div>
                  <div className="win95-config-line">task_type = {JSON.stringify(values.task_type)}</div>
                </div>
              </div>
            </CellFrame>

            <CellFrame
              index="3"
              kind="code"
              title="Protected Python"
              active={active.code}
              onToggle={() => toggle("code")}
              action={<BevelButton primary disabled={!active.code} onClick={() => markRun("ячейка кода")}><Play size={12} /> Run cell</BevelButton>}
            >
              <pre className="win95-code" aria-label="Код только для чтения"><code>{code.split("\n").map((line, i) => <span key={i}><span className="code-ln">{String(i + 1).padStart(2, "0")}  </span>{line}{"\n"}</span>)}</code></pre>
              <div className="win95-output">
                <div className="win95-output-head">
                  <div className="win95-output-label"><Power size={12} /> Output · сохранённый результат</div>
                  <span className="win95-output-status">{runMessage}</span>
                </div>
                <pre className="win95-output-text">Gradient descent updates the model parameters to reduce the loss.</pre>
              </div>
            </CellFrame>
          </div>
        </div>
        <footer className="win95-statusbar">
          <span className="win95-status-segment">Готово — безопасный режим макета</span>
          <span className="win95-status-segment">Ячеек пропущено: {3 - Object.values(active).filter(Boolean).length}</span>
          <span className="win95-status-segment">Python · только чтение</span>
        </footer>
      </div>
    </main>
  );
}
