import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AiProviderId } from "@/lib/ai-settings";

export type SessionAiCredential = {
  providerId: AiProviderId;
  apiKey: string;
};

type SessionAiKeyContextValue = {
  credential: SessionAiCredential | null;
  setCredential: (credential: SessionAiCredential | null) => void;
};

const SessionAiKeyContext = createContext<SessionAiKeyContextValue | null>(null);

export function SessionAiKeyProvider({ children }: { children: ReactNode }) {
  const [credential, setCredential] = useState<SessionAiCredential | null>(null);
  const value = useMemo(() => ({ credential, setCredential }), [credential]);

  return (
    <SessionAiKeyContext.Provider value={value}>
      {children}
    </SessionAiKeyContext.Provider>
  );
}

export function useSessionAiKey() {
  const value = useContext(SessionAiKeyContext);
  if (!value) {
    throw new Error("useSessionAiKey must be used inside SessionAiKeyProvider.");
  }
  return value;
}
