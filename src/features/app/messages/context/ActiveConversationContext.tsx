"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ActiveConversationContextType {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

const ActiveConversationContext = createContext<ActiveConversationContextType>({
  activeConversationId: null,
  setActiveConversationId: () => { },
});

export function ActiveConversationProvider({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  return (
    <ActiveConversationContext.Provider value={{ activeConversationId, setActiveConversationId }}>
      {children}
    </ActiveConversationContext.Provider>
  );
}

export function useActiveConversation() {
  return useContext(ActiveConversationContext);
}
