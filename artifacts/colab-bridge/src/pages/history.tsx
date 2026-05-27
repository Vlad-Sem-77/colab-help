import { format } from "date-fns";
import { Trash2Icon, TrashIcon, HistoryIcon } from "lucide-react";
import { 
  useListHistory, 
  getListHistoryQueryKey,
  useClearHistory,
  useDeleteHistoryEntry
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: history, isLoading } = useListHistory({
    query: {
      queryKey: getListHistoryQueryKey(),
    }
  });

  const clearMutation = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        toast({ title: "History cleared", description: "All experiment history has been deleted." });
      }
    }
  });

  const deleteMutation = useDeleteHistoryEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
      }
    }
  });

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Experiment History</h1>
          <p className="text-muted-foreground text-sm">Past generations and comparisons</p>
        </div>
        <Button 
          variant="destructive" 
          onClick={() => clearMutation.mutate({})}
          disabled={!history?.length || clearMutation.isPending}
          className="font-mono text-xs"
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          CLEAR_ALL
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-md p-4 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))
        ) : !history?.length ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
            <HistoryIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>No experiments recorded yet.</p>
          </div>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="bg-card border border-border rounded-md p-4 flex flex-col gap-3 group transition-colors hover:border-primary/50 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: entry.id })}
              >
                <Trash2Icon className="w-4 h-4" />
              </Button>
              
              <div className="flex items-start justify-between pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20">
                    {entry.taskType.toUpperCase()}
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {entry.mode === 'auto' ? 'AUTO' : 'MANUAL'}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {entry.modelName || entry.model || 'Unknown Model'}
                  </span>
                  {entry.modelProvider && (
                    <span className="text-xs text-muted-foreground font-mono">
                      by {entry.modelProvider}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {format(new Date(entry.createdAt), "MMM d, HH:mm:ss")}
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded text-sm font-mono text-foreground/80 line-clamp-2">
                {entry.prompt}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                {entry.totalTokens != null && (
                  <div className="flex items-center gap-1">
                    <span className="text-foreground/50">TOKENS:</span>
                    <span className="text-foreground">{entry.totalTokens}</span>
                  </div>
                )}
                {entry.executionTime != null && (
                  <div className="flex items-center gap-1">
                    <span className="text-foreground/50">TIME:</span>
                    <span className="text-foreground">{entry.executionTime.toFixed(2)}s</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
