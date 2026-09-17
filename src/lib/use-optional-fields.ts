"use client";

import { useEffect, useState } from "react";
import { DEFAULT_OPTIONAL_KEYS } from "./fields";

const STORAGE_KEY = "specibase.optionalFields";

// Which optional columns are turned on — shared between the sample
// table and the template/import dialogs so "what shows in the table"
// and "what's in the CSV template" stay the same set by default.
export function useOptionalFields() {
  const [selected, setSelected] = useState<string[]>(DEFAULT_OPTIONAL_KEYS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      // One-shot hydration from localStorage on mount, not a sync loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setSelected(JSON.parse(stored));
    } catch {
      // ignore — fall back to defaults
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      // ignore — non-critical persistence
    }
  }, [selected, loaded]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return { selected, setSelected, toggle };
}
