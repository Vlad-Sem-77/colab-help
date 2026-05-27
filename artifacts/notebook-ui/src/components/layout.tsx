import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Book, History, Settings, Download, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useColabUrl } from "@/hooks/use-colab-url";
import { usePingColab } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { colabUrl, setColabUrl } = useColabUrl();
  const { toast } = useToast();
  const [pingStatus, setPingStatus] = useState<"idle" | "ok" | "err">("idle");

  const pingMutation = usePingColab({
    mutation: {
      onSuccess: (data) => {
        setPingStatus(data.online ? "ok" : "err");
        toast({
          title: data.online ? "Подключено" : "Нет соединения",
          description: data.message,
          variant: data.online ? "default" : "destructive",
        });
      },
      onError: () => {
        setPingStatus("err");
        toast({ title: "Ошибка", description: "Не удалось выполнить запрос", variant: "destructive" });
      },
    },
  });

  const handlePing = () => {
    if (!colabUrl) {
      toast({ title: "Введите URL", description: "Вставьте Cloudflare URL из Colab", variant: "destructive" });
      return;
    }
    setPingStatus("idle");
    pingMutation.mutate({ data: { colabUrl } });
  };

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings className="w-4 h-4" />
                <span>Colab Connection</span>
              </div>
              {pingStatus === "ok" && <Wifi className="w-4 h-4 text-green-500" />}
              {pingStatus === "err" && <WifiOff className="w-4 h-4 text-red-500" />}
            </div>
            <Input
              placeholder="https://xxxx.trycloudflare.com"
              value={colabUrl}
              onChange={(e) => { setColabUrl(e.target.value); setPingStatus("idle"); }}
              className="bg-background text-xs"
              data-testid="input-colab-url"
            />
            <Button
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={handlePing}
              disabled={pingMutation.isPending}
            >
              {pingMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : pingStatus === "ok" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <Wifi className="w-3 h-3" />
              )}
              {pingMutation.isPending ? "Проверка..." : pingStatus === "ok" ? "ONLINE — PING" : "PING"}
            </Button>
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
