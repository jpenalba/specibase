"use client";

import { useEffect, useMemo, useState } from "react";
import { Protocol } from "@/lib/protocols-store";
import { PROTOCOL_TYPE_LABELS } from "@/lib/protocol-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Same shape as SamplePicker, for attaching existing protocols to a
// project — fetched once per dialog open, then filtered client-side.
export function ProtocolPicker({
  selectedIds,
  onChange,
  excludeIds,
}: {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  // Protocols to leave out of the list entirely — e.g. ones already
  // attached to the project this picker is adding to.
  excludeIds?: Set<string>;
}) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/protocols")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setProtocols((data.protocols ?? []) as Protocol[]);
      })
      .catch(() => {
        // Attaching is optional — an empty list here just means nothing
        // to pick from yet.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectable = useMemo(
    () => (excludeIds ? protocols.filter((p) => !excludeIds.has(p.id)) : protocols),
    [protocols, excludeIds]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter((p) => p.name.toLowerCase().includes(q));
  }, [selectable, filter]);

  function toggle(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next);
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label>Protocols</Label>
        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
      </div>
      <Input placeholder="Search by name" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="max-h-48 overflow-y-auto rounded-md border border-input">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading protocols...</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No protocols match.</p>
        ) : (
          filtered.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-b-0 hover:bg-accent"
            >
              <Checkbox
                checked={selectedIds.has(p.id)}
                onCheckedChange={(checked) => toggle(p.id, checked === true)}
              />
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                {PROTOCOL_TYPE_LABELS[p.protocol_type]}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
