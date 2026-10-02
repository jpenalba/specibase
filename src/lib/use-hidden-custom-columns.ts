"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "specibase.hiddenCustomColumns";

// Which "Other: specify" custom columns are hidden from the table, map
// popups, and CSV/PDF export — opt-out, unlike useOptionalFields' opt-in
// `selected` list, since a custom column should stay visible the moment
// it's added (that's the point of adding it) and only disappear once
// someone explicitly hides it, rather than defaulting to hidden the way
// an unticked preset field does.
//
// Scoped the same way useOptionalFields is — a project or collection id
// keeps the choice local to that one table; omit it for the plain
// Database page's own account-wide setting.
export function useHiddenCustomColumns(scopeKey?: string) {
  const storageKey = scopeKey ? `${STORAGE_PREFIX}:${scopeKey}` : STORAGE_PREFIX;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let next = new Set<string>();
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) next = new Set(JSON.parse(stored));
    } catch {
      // ignore — fall back to nothing hidden
    }
    // One-shot hydration whenever the scope changes, not a sync loop.
    Promise.resolve().then(() => {
      setHidden(next);
      setLoaded(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...hidden]));
    } catch {
      // ignore — non-critical persistence
    }
  }, [hidden, loaded, storageKey]);

  function toggle(columnId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }

  return { hidden, toggle };
}
