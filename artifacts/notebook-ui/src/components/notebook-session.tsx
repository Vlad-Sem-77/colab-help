import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearCurrentNotebook,
  loadCurrentNotebook,
  saveCurrentNotebook,
} from "@/lib/notebook-persistence";
import { parseNotebook, type Notebook } from "@/lib/notebook";

type NotebookSessionValue = {
  notebook: Notebook | null;
  isRestoringNotebook: boolean;
  restoreError: string | null;
  replaceNotebook: (notebook: Notebook) => Promise<boolean>;
};

const NotebookSessionContext = createContext<NotebookSessionValue | null>(null);

export function NotebookSessionProvider({ children }: { children: ReactNode }) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [isRestoringNotebook, setIsRestoringNotebook] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const savedNotebook = await loadCurrentNotebook();
        if (savedNotebook !== null && active) {
          setNotebook(parseNotebook(savedNotebook));
        }
      } catch (error) {
        if (active) {
          setRestoreError(
            error instanceof Error
              ? error.message
              : "Сохранённый блокнот повреждён или недоступен.",
          );
        }
        try {
          await clearCurrentNotebook();
        } catch {
          // Keep the restore error visible; a future valid upload can replace this record.
        }
      } finally {
        if (active) setIsRestoringNotebook(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const replaceNotebook = useCallback(async (nextNotebook: Notebook) => {
    try {
      await saveCurrentNotebook(nextNotebook.original ?? nextNotebook);
      setNotebook(nextNotebook);
      setRestoreError(null);
      return true;
    } catch {
      setNotebook(nextNotebook);
      return false;
    }
  }, []);

  return (
    <NotebookSessionContext.Provider
      value={{ notebook, isRestoringNotebook, restoreError, replaceNotebook }}
    >
      {children}
    </NotebookSessionContext.Provider>
  );
}

export function useNotebookSession() {
  const session = useContext(NotebookSessionContext);
  if (!session) throw new Error("useNotebookSession must be used inside NotebookSessionProvider");
  return session;
}
