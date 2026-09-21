"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SampleOption = { id: string; primary_identifier: string; species: string };

// Fetched once per dialog open, then filtered client-side — the samples
// table is small enough (this is a single-lab field database) that a
// dedicated search endpoint isn't worth the extra round trip.
export function SamplePicker({
  selectedIds,
  onChange,
}: {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const [samples, setSamples] = useState<SampleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteNotFound, setPasteNotFound] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/samples")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const rows = (data.samples ?? []) as SampleOption[];
        setSamples(
          rows.map((s) => ({
            id: s.id,
            primary_identifier: s.primary_identifier,
            species: s.species,
          }))
        );
      })
      .catch(() => {
        // Sample selection is optional when saving a project — an empty
        // list here just means nothing to pick from yet.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter(
      (s) =>
        s.primary_identifier.toLowerCase().includes(q) ||
        s.species?.toLowerCase().includes(q)
    );
  }, [samples, filter]);

  function toggle(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  function applyPaste() {
    const tokens = pasteText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const byIdentifier = new Map(
      samples.map((s) => [s.primary_identifier.toLowerCase(), s.id])
    );
    const next = new Set(selectedIds);
    const notFound: string[] = [];
    for (const token of tokens) {
      const id = byIdentifier.get(token.toLowerCase());
      if (id) next.add(id);
      else notFound.push(token);
    }
    onChange(next);
    setPasteNotFound(notFound);
    setPasteText("");
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label>Samples</Label>
        <span className="text-xs text-muted-foreground">
          {selectedIds.size} selected
        </span>
      </div>
      <Input
        placeholder="Search by Sample ID or species"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-md border border-input">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading samples...</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No samples match.</p>
        ) : (
          filtered.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-b-0 hover:bg-accent"
            >
              <Checkbox
                checked={selectedIds.has(s.id)}
                onCheckedChange={(checked) => toggle(s.id, checked === true)}
              />
              <span className="font-mono">{s.primary_identifier}</span>
              {s.species && (
                <span className="truncate text-muted-foreground">{s.species}</span>
              )}
            </label>
          ))
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer select-none text-muted-foreground">
          Paste a list of Sample IDs
        </summary>
        <div className="mt-2 grid gap-1.5">
          <Textarea
            rows={2}
            placeholder="e.g. MFN-001, MFN-002, MFN-005"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={applyPaste}
            disabled={!pasteText.trim()}
          >
            Add to selection
          </Button>
          {pasteNotFound.length > 0 && (
            <p className="text-xs text-destructive">
              Not found: {pasteNotFound.join(", ")}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
