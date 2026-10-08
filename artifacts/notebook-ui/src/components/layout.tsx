import { Link, useLocation } from "wouter";
import { Book, History } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="notebook-app-shell flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="notebook-sidebar w-64 border-r border-border bg-card flex flex-col h-full">
        <div className="notebook-brand p-4 border-b border-border">
          <h1 className="text-xl font-bold font-mono tracking-tighter">Notebook UI</h1>
        </div>
        
        <nav className="notebook-sidebar-nav flex-1 p-4 space-y-2" aria-label="Основная навигация">
          <Link href="/">
            <div className={`notebook-nav-link flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
              <Book className="w-5 h-5" />
              <span className="font-medium">Notebook</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`notebook-nav-link flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${location === '/history' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
              <History className="w-5 h-5" />
              <span className="font-medium">History</span>
            </div>
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
