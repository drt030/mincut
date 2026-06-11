"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { HolderTeaser } from "@/lib/holderTeasers";

/**
 * Per MASTER-PLAN Decision 10: server pages compute know-how holder
 * counts on the pre-strip graph (`computeHolderTeasers`) and provide
 * them here, so client components show true counts for locked domains
 * whose organization nodes were stripped. Components fall back to
 * computing from the visible graph when no provider is mounted
 * (unit tests, free domains — both give identical numbers there).
 */
const HolderTeasersContext = createContext<Record<string, HolderTeaser>>({});

export function HolderTeaserProvider({
  teasers,
  children,
}: {
  teasers: Record<string, HolderTeaser>;
  children: ReactNode;
}) {
  return <HolderTeasersContext.Provider value={teasers}>{children}</HolderTeasersContext.Provider>;
}

export function useHolderTeasers(): Record<string, HolderTeaser> {
  return useContext(HolderTeasersContext);
}

export function useHolderTeaser(nodeId: string): HolderTeaser | undefined {
  return useContext(HolderTeasersContext)[nodeId];
}
