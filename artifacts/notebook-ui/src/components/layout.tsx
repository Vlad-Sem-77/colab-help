import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Book, Monitor, Waves } from "lucide-react";
import { RotatingEye } from "./rotating-eye";
import { Win95Eye } from "./win95-eye";

type NotebookTheme = "light-waves" | "windows95";

const THEME_STORAGE_KEY = "notebook-ui-theme";
const NotebookThemeContext = createContext<{
  theme: NotebookTheme;
  setTheme: (theme: NotebookTheme) => void;
} | null>(null);

function readSavedTheme(): NotebookTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "windows95"
      ? "windows95"
      : "light-waves";
  } catch {
    return "light-waves";
  }
}

export function useNotebookTheme() {
  const context = useContext(NotebookThemeContext);
  if (!context) throw new Error("useNotebookTheme must be used inside Layout");
  return context;
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
        aria-label="Ньювейв"
        title="Ньювейв"
        aria-pressed={theme === "light-waves"}
        onClick={() => onChange("light-waves")}
        data-testid="button-theme-light-waves"
      >
        <Waves aria-hidden="true" />
        <span>Ньювейв</span>
      </button>
      <button
        type="button"
        aria-label="Олдскул"
        title="Олдскул"
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

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [theme, setTheme] = useState<NotebookTheme>(readSavedTheme);

  useEffect(() => {
    document.documentElement.dataset.notebookTheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme still works for this visit when browser storage is unavailable.
    }
  }, [theme]);

  return (
    <NotebookThemeContext.Provider value={{ theme, setTheme }}>
      <div className="notebook-app-shell flex h-screen w-full bg-background text-foreground overflow-hidden">
        <aside className="notebook-sidebar w-64 border-r border-border bg-card flex flex-col h-full">
          <div className="notebook-brand p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {theme === "windows95" ? (
                <Win95Eye size={32} className="shrink-0" />
              ) : (
                <RotatingEye size={32} className="shrink-0" />
              )}
              <h1 className="text-xl font-bold font-mono tracking-tighter">Notebook UI</h1>
            </div>
          </div>

          <nav className="notebook-sidebar-nav flex-1 p-4" aria-label="Основная навигация">
            <ThemePicker theme={theme} onChange={setTheme} />
            <div className="notebook-nav-links">
              <Link href="/">
                <div className={`notebook-nav-link flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                  <Book className="w-5 h-5" />
                  <span className="font-medium">Notebook</span>
                </div>
              </Link>
            </div>
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </NotebookThemeContext.Provider>
  );
}
