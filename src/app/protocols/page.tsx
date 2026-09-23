"use client";

import { useCallback, useEffect, useState } from "react";
import { Protocol } from "@/lib/protocols-store";
import { ProtocolDialog } from "@/components/protocols/protocol-dialog";
import { ProtocolRow } from "@/components/protocols/protocol-row";
import { Button } from "@/components/ui/button";

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Not called with loading reset to true on every refetch (e.g. after
  // adding a protocol) — only the very first load, which `loading`'s
  // initial state already covers, needs the "Loading..." placeholder.
  const load = useCallback(() => {
    fetch("/api/protocols")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setProtocols(data.protocols ?? []);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDeleted(id: string) {
    setProtocols((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Protocols</h1>
          <p className="text-sm text-muted-foreground">
            Field, lab, bioinformatic, and other protocols — uploaded as a
            ready-made PDF, or built directly in Specibase.
          </p>
        </div>
        <ProtocolDialog onSaved={load} trigger={<Button>Add protocol</Button>} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load protocols: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">supabase/migrations/0021_protocols.sql</code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : protocols.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No protocols yet. Add one to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {protocols.map((protocol) => (
            <ProtocolRow
              key={protocol.id}
              protocol={protocol}
              onSaved={load}
              onDeleted={() => handleDeleted(protocol.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
