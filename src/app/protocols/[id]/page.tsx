"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Protocol } from "@/lib/protocols-store";
import { PROTOCOL_TYPE_LABELS } from "@/lib/protocol-types";
import { formatTimestampDisplay } from "@/lib/date-format";
import { renderMarkdownToPdf } from "@/lib/markdown-pdf";
import { MarkdownEditor } from "@/components/projects/markdown-editor";
import { Button } from "@/components/ui/button";

// The "Build in Specibase" side of a protocol — a plain markdown box under
// the protocol's own name, saved back onto the same `protocols` row
// (content + updated_at) rather than a separate document table. A PDF-
// sourced protocol never lands here (ProtocolRow links it straight to the
// file instead), but is handled gracefully if visited directly.
export default function ProtocolBuilderPage() {
  const { id } = useParams<{ id: string }>();

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/protocols/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setProtocol(data.protocol);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function startEditing() {
    setDraft(protocol?.content ?? "");
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/protocols/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.errors?.join(" ") ?? "Couldn't save this protocol.");
        return;
      }
      setProtocol(data.protocol);
      setEditing(false);
    } catch {
      setSaveError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (!protocol) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 40;
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(protocol.name, margin, margin);
      doc.setFont("helvetica", "normal");
      let y = margin + 26;

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `${PROTOCOL_TYPE_LABELS[protocol.protocol_type]} · Last edited ${formatTimestampDisplay(protocol.updated_at)}`,
        margin,
        y
      );
      doc.setTextColor(0);
      y += 20;

      if (protocol.content) {
        renderMarkdownToPdf(doc, protocol.content, y, {
          x: margin,
          maxWidth,
          pageHeight,
          marginBottom: margin,
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(140);
        doc.text("Nothing written yet.", margin, y);
        doc.setTextColor(0);
      }

      const slug = protocol.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      doc.save(`specibase-protocol-${slug}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground sm:p-10">Loading...</div>
    );
  }

  if (error || !protocol) {
    return (
      <div className="mx-auto max-w-4xl p-6 sm:p-10">
        <Link
          href="/protocols"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to protocols
        </Link>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? "Protocol not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-10">
      <Link
        href="/protocols"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to protocols
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{protocol.name}</h1>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {PROTOCOL_TYPE_LABELS[protocol.protocol_type]}
            </span>
          </div>
          {protocol.description && (
            <p className="mt-1 text-sm text-muted-foreground">{protocol.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatTimestampDisplay(protocol.created_at)} · Last edited{" "}
            {formatTimestampDisplay(protocol.updated_at)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Exporting..." : "Export PDF"}
        </Button>
      </div>

      {protocol.source_type === "pdf" ? (
        <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          This protocol is an uploaded PDF, not one built in Specibase.{" "}
          {protocol.pdf_url && (
            <a href={protocol.pdf_url} target="_blank" rel="noopener noreferrer" className="underline">
              Open the PDF
            </a>
          )}
        </div>
      ) : editing ? (
        <div className="grid gap-3">
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <MarkdownEditor
            uploadUrl={`/api/protocols/${protocol.id}/images`}
            value={draft}
            onChange={setDraft}
            rows={20}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : protocol.content ? (
        <div className="grid gap-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{protocol.content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Button onClick={startEditing}>Start writing</Button>
        </div>
      )}
    </div>
  );
}
