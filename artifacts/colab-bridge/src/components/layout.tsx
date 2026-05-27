import { Link, useLocation } from "wouter";
import { BeakerIcon, HistoryIcon, ActivityIcon } from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: healthData, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 10000,
    }
  });

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <aside className="w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border gap-2 font-mono font-bold tracking-tight">
          <BeakerIcon className="h-5 w-5 text-sidebar-primary" />
          <span>BRIDGE_CTL</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          <Link href="/">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${location === '/' ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80'}`}>
              <ActivityIcon className="h-4 w-4" />
              <span>Experiment Panel</span>
            </div>
          </Link>
          <Link href="/history">
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${location === '/history' ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80'}`}>
              <HistoryIcon className="h-4 w-4" />
              <span>History Log</span>
            </div>
          </Link>
        </nav>

        <div className="p-4 border-t border-sidebar-border text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-sidebar-foreground/50">API STATUS</span>
            <div className="flex items-center gap-2">
              <span className="text-sidebar-foreground/80">{healthData?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}</span>
              <div className={`h-2 w-2 rounded-full ${healthData?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'} ${isError ? 'bg-red-500' : ''}`} />
            </div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
