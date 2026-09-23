"use client";

import { useEffect, useState } from "react";
import { GbifSpeciesSuggestion, GbifClassification } from "@/lib/gbif";
import { Input } from "@/components/ui/input";

// Free-text species input with a GBIF-backed autocomplete dropdown — never
// blocks on a match (an undescribed species or morphospecies code is a
// normal, valid value here), but picking a suggestion resolves it against
// GBIF's backbone taxonomy and reports the result via onResolved so the
// parent form can auto-fill Genus/Family/Order/Class.
export function SpeciesInput({
  id,
  value,
  onChange,
  onResolved,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onResolved: (match: GbifClassification | null) => void;
}) {
  const [results, setResults] = useState<GbifSpeciesSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Debounced search-as-you-type, same pattern as add-gbif-species-dialog.tsx.
  useEffect(() => {
    const trimmed = value.trim();
    const handle = setTimeout(() => {
      if (!trimmed) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      fetch(`/api/gbif/species?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [value]);

  async function pick(suggestion: GbifSpeciesSuggestion) {
    onChange(suggestion.scientificName);
    setOpen(false);
    setResults([]);
    setResolving(true);
    try {
      const res = await fetch(
        `/api/gbif/species/match?name=${encodeURIComponent(suggestion.scientificName)}`
      );
      const data = await res.json();
      onResolved(data.match ?? null);
    } catch {
      onResolved(null);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delayed so a suggestion's onMouseDown (which also
          // preventDefaults the focus change) has a chance to run first.
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && value.trim() && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-input bg-card shadow-md">
          {searching ? (
            <p className="p-2 text-xs text-muted-foreground">Searching GBIF...</p>
          ) : results.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">
              No GBIF matches — free text is fine.
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                className="flex w-full items-center justify-between gap-2 border-b border-input px-2 py-1.5 text-left text-sm last:border-b-0 hover:bg-accent"
              >
                <span className="italic">{r.scientificName}</span>
                {r.rank && <span className="text-xs text-muted-foreground">{r.rank}</span>}
              </button>
            ))
          )}
        </div>
      )}
      {resolving && (
        <p className="mt-1 text-[10px] text-muted-foreground">Filling in taxonomy from GBIF…</p>
      )}
    </div>
  );
}
