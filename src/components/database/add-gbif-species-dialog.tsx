"use client";

import { useEffect, useState } from "react";
import { GBIF_STYLES, DEFAULT_GBIF_STYLE, GbifStyleId, GbifSpeciesSuggestion } from "@/lib/gbif";
import { GbifSpeciesLayer } from "@/lib/gbif-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AddGbifSpeciesDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (layer: GbifSpeciesLayer) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GbifSpeciesSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GbifSpeciesSuggestion | null>(null);
  const [style, setStyle] = useState<GbifStyleId>(DEFAULT_GBIF_STYLE);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Debounced search-as-you-type against GBIF's species suggest endpoint,
  // proxied through our own API route (see its comment for why). Every
  // state update happens inside the timeout callback, including clearing
  // the results for an empty query, so none of it runs synchronously
  // within the effect body itself.
  useEffect(() => {
    const trimmed = query.trim();
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
  }, [query]);

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setStyle(DEFAULT_GBIF_STYLE);
    setErrors([]);
  }

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/gbif-layers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxon_key: selected.key,
          scientific_name: selected.scientificName,
          rank: selected.rank,
          style,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Couldn't add this species."]);
        return;
      }
      onAdded(data.layer);
      onOpenChange(false);
      reset();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a species range from GBIF</DialogTitle>
          <DialogDescription>
            Search GBIF for a species, then add its occurrence-density map as a layer here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="gbif-species-search">Species name</Label>
            <Input
              id="gbif-species-search"
              placeholder="e.g. Malurus cyaneus"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
            />
          </div>

          {query.trim() && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-input">
              {searching ? (
                <p className="p-3 text-sm text-muted-foreground">Searching...</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No matches on GBIF.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b border-input px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-accent",
                      selected?.key === r.key && "bg-accent"
                    )}
                  >
                    <span className="italic">{r.scientificName}</span>
                    {r.rank && <span className="text-xs text-muted-foreground">{r.rank}</span>}
                  </button>
                ))
              )}
            </div>
          )}

          {selected && (
            <div className="grid gap-1.5">
              <Label>Style</Label>
              <div className="flex flex-wrap gap-2">
                {GBIF_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs",
                      style === s.id ? "border-foreground bg-accent" : "border-input hover:bg-accent"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleAdd} disabled={!selected || submitting}>
            {submitting ? "Adding..." : "Add to map"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
