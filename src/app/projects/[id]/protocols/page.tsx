"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Protocol } from "@/lib/protocols-store";
import { ProtocolProjectLink } from "@/lib/projects-store";
import { ProtocolDialog } from "@/components/protocols/protocol-dialog";
import { ProtocolRow } from "@/components/protocols/protocol-row";
import { ManageProtocolsDialog } from "@/components/projects/manage-protocols-dialog";
import { Button } from "@/components/ui/button";

// This project's attached protocols — a filtered slice of the global
// Protocols list, same relationship as the Samples tab has to Database.
export default function ProjectProtocolsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [links, setLinks] = useState<ProtocolProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/protocols").then((res) => res.json()),
      fetch("/api/projects").then((res) => res.json()),
    ])
      .then(([protocolsData, projectsData]) => {
        if (protocolsData.errors?.length > 0) {
          setError(protocolsData.errors.join(" "));
          return;
        }
        if (projectsData.errors?.length > 0) {
          setError(projectsData.errors.join(" "));
          return;
        }
        setError(null);
        setProtocols(protocolsData.protocols ?? []);
        setLinks(projectsData.protocolLinks ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attachedIds = useMemo(
    () => new Set(links.filter((l) => l.project_id === projectId).map((l) => l.protocol_id)),
    [links, projectId]
  );

  const attached = useMemo(
    () => protocols.filter((p) => attachedIds.has(p.id)),
    [protocols, attachedIds]
  );

  function attachProtocol(protocol: Protocol) {
    fetch(`/api/projects/${projectId}/protocols`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolIds: [protocol.id] }),
    })
      .then(() => load())
      .catch(() => {
        // Best-effort — the new protocol still shows up in the global
        // list even if attaching here failed.
      });
  }

  function handleDeleted(id: string) {
    setProtocols((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Protocols</h1>
          <p className="text-sm text-muted-foreground">
            Protocols attached to this project. Attach an existing one, or create a new one and
            attach it here.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ManageProtocolsDialog
            projectId={projectId}
            attachedProtocols={attached}
            onSaved={load}
            trigger={<Button variant="outline">Manage protocols</Button>}
          />
          <ProtocolDialog onSaved={load} afterCreate={attachProtocol} trigger={<Button>New protocol</Button>} />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load protocols: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0030_protocol_projects_and_project_logs.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : attached.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No protocols attached yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attached.map((protocol) => (
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
