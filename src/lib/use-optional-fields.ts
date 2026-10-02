"use client";

import { useEffect, useState } from "react";
import { DEFAULT_OPTIONAL_KEYS } from "./fields";

const STORAGE_PREFIX = "specibase.optionalFields";

// Which optional columns are turned on — shared between the sample
// table and the template/import dialogs so "what shows in the table"
// and "what's in the CSV template" stay the same set by default.
//
// `scopeKey` (a project's id) keeps that choice project-specific — toggling
// a column in one project's Samples tab doesn't touch any other project's,
// or the plain Database page's own setting. Omit it for that unscoped,
// account-wide setting (the Database page, and Collections' own staging
// flow) — unchanged from before this param existed, same storage key and
// all.
export function useOptionalFields(scopeKey?: string) {
  const storageKey = scopeKey ? `${STORAGE_PREFIX}:${scopeKey}` : STORAGE_PREFIX;
  const [selected, setSelected] = useState<string[]>(DEFAULT_OPTIONAL_KEYS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let next = DEFAULT_OPTIONAL_KEYS;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) next = JSON.parse(stored);
    } catch {
      // ignore — fall back to defaults
    }
    // One-shot hydration whenever the scope changes, not a sync loop.
    Promise.resolve().then(() => {
      setSelected(next);
      setLoaded(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selected));
    } catch {
      // ignore — non-critical persistence
    }
  }, [selected, loaded, storageKey]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return { selected, setSelected, toggle };
}
