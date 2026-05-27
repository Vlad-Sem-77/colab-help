import { useListHistory, useDeleteHistoryEntry, useClearHistory, getListHistoryQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { History, Trash2, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function HistoryPage() {
  const { data: history, isLoading } = useListHistory();
  const deleteEntry = useDeleteHistoryEntry();
  const clearHistory = useClearHistory();
  const queryClient = useQueryClient();

  const handleDelete = (id: number) => {
    deleteEntry.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
      }
    });
  };

  const handleClear = () => {
    clearHistory.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading history...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Run History</h1>
          <p className="text-muted-foreground text-sm">Past experiments and generations</p>
        </div>
        {history && history.length > 0 && (
          <Button variant="destructive" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {!history || history.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center flex flex-col items-center">
          <History className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No history yet</h3>
          <p className="text-muted-foreground text-sm">Run some experiments in the notebook to see them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Collapsible key={entry.id} className="bg-card border rounded-lg overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                <div className="flex items-center gap-4 flex-1">
                  <Badge variant="outline" className="font-mono">{entry.taskType}</Badge>
                  <span className="text-sm font-medium">{entry.modelName || entry.model || "Unknown Model"}</span>
                  <div className="flex items-center text-xs text-muted-foreground gap-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(entry.createdAt), "MMM d, HH:mm")}</span>
                    {entry.totalTokens && <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {entry.totalTokens} tokens</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">View Result</Button>
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <CollapsibleContent className="border-b bg-background/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
                  <div className="bg-card p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</h4>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-foreground/80">{entry.prompt}</pre>
                  </div>
                  <div className="bg-card p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Result</h4>
                    <pre className="text-sm whitespace-pre-wrap font-mono text-green-400">{entry.result}</pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
