"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BioNotesBlock } from "@/lib/project-bio-notes-store";
import { formatTimestampDisplay } from "@/lib/date-format";
import { MarkdownEditor } from "./markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// One notebook entry — view/edit toggle, same pattern as MarkdownField, but
// with a title alongside the markdown body and up/down reorder controls
// instead of MarkdownField's "one field per project" simplicity.
function BlockCard({
  block,
  projectId,
  isFirst,
  isLast,
  onMove,
  onSaved,
}: {
  block: BioNotesBlock;
  projectId: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaved: (block: BioNotesBlock) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(block.title);
  const [contentDraft, setContentDraft] = useState(block.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setTitleDraft(block.title);
    setContentDraft(block.content);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const title = titleDraft.trim();
    if (!title) {
      setError("A title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bio-notes-blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: contentDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't save the block.");
        return;
      }
      onSaved(data.block);
      setEditing(false);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="grid gap-3 rounded-lg border border-border p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder="Block title"
          className="font-medium"
        />
        <MarkdownEditor projectId={projectId} value={contentDraft} onChange={setContentDraft} rows={10} />
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{block.title}</h3>
          <p className="text-xs text-muted-foreground">{formatTimestampDisplay(block.created_at)}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
            aria-label={`Move "${block.title}" up`}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
            aria-label={`Move "${block.title}" down`}
          >
            <ChevronDown className="size-4" />
          </button>
          <Button variant="outline" size="sm" onClick={startEditing}>
            Edit
          </Button>
        </div>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content || "*Empty block.*"}</ReactMarkdown>
      </div>
    </div>
  );
}

// "Add block" pulls up a blank version of the same title+editor form —
// kept separate from BlockCard since there's no existing block to render
// while this is open.
function AddBlockForm({
  projectId,
  onAdded,
  onCancel,
}: {
  projectId: string;
  onAdded: (block: BioNotesBlock) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bio-notes-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't add the block.");
        return;
      }
      onAdded(data.block);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Block title"
        className="font-medium"
        autoFocus
      />
      <MarkdownEditor projectId={projectId} value={content} onChange={setContent} rows={10} />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// A project's "Bioinformatic notes" tab: a notebook of titled, dated
// markdown blocks — one per entry, rather than one running document like
// the Info tab's Background/Notes (MarkdownField). New blocks always go
// at the bottom; existing ones can be edited in place or reordered.
export function BioNotesSection({ projectId }: { projectId: string }) {
  const [blocks, setBlocks] = useState<BioNotesBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/bio-notes-blocks`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setBlocks(data.blocks ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the server.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function replaceBlock(updated: BioNotesBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  // Optimistic reorder, same "update locally, PATCH in the background"
  // approach used elsewhere (e.g. the Simple grid) — the swap is instant,
  // and a failed save just leaves next load() to correct it rather than
  // blocking the click on a round-trip.
  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
    try {
      const res = await fetch(`/api/projects/${projectId}/bio-notes-blocks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedBlockIds: next.map((b) => b.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Couldn't save the new order — try again.");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {blocks.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No entries yet — add the first one below.</p>
      )}

      {blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          block={block}
          projectId={projectId}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
          onMove={(direction) => handleMove(index, direction)}
          onSaved={replaceBlock}
        />
      ))}

      {adding ? (
        <AddBlockForm
          projectId={projectId}
          onAdded={(block) => {
            setBlocks((prev) => [...prev, block]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div>
          <Button onClick={() => setAdding(true)}>Add block</Button>
        </div>
      )}
    </div>
  );
}
