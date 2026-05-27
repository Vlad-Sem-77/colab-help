import { Link, useLocation } from "wouter";
import { Book, History, Settings, Download } from "lucide-react";
import { useColabUrl } from "@/hooks/use-colab-url";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { colabUrl, setColabUrl } = useColabUrl();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold font-mono tracking-tighter">Notebook UI</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${location === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
              <Book className="w-5 h-5" />
              <span className="font-medium">Notebook</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${location === '/history' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
              <History className="w-5 h-5" />
              <span className="font-medium">History</span>
            </div>
          </Link>
        </nav>

        <div className="p-4 border-t border-border bg-muted/30 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Settings className="w-4 h-4" />
              <span>Colab Connection</span>
            </div>
            <Input
              placeholder="https://...ngrok-free.app"
              value={colabUrl}
              onChange={(e) => setColabUrl(e.target.value)}
              className="bg-background text-xs"
              data-testid="input-colab-url"
            />
            <p className="text-[10px] text-muted-foreground leading-tight">
              Вставьте ngrok URL из вывода ячейки Colab
            </p>
          </div>
          <a href="/api/colab/notebook" download="colab_backend.ipynb">
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
              <Download className="w-3 h-3" />
              Скачать Colab-ноутбук
            </Button>
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
