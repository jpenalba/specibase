"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import type { ProjectReference } from "@/lib/project-references-store";
import type { CitationMetadata } from "@/lib/citation-metadata";
import { formatAuthorList } from "@/lib/apa-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

function SearchPaperDialog({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CitationMetadata[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingDoi, setAddingDoi] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults([]);
      setSearchError(null);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/crossref/search?title=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.errors?.join(" ") ?? "Search failed.");
        return;
      }
      const found: CitationMetadata[] = data.results ?? [];
      setResults(found);
      if (found.length === 0) {
        setSearchError(
          "No matches found — try a shorter or more exact title, or add this one manually."
        );
      }
    } catch {
      setSearchError("Couldn't reach the server.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(metadata: CitationMetadata) {
    setAddingDoi(metadata.doi);
    setSearchError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSearchError(data.errors?.join(" ") ?? "Couldn't add that reference.");
        return;
      }
      onAdded();
      handleOpenChange(false);
    } catch {
      setSearchError("Couldn't reach the server.");
    } finally {
      setAddingDoi(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="size-4" />
          Search for a paper
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search for a paper</DialogTitle>
          <DialogDescription>
            Searches Crossref by title and formats the citation in APA style automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Paper title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </form>
        {searchError && <p className="text-sm text-destructive">{searchError}</p>}
        {results.length > 0 && (
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {results.map((r) => (
              <div key={r.doi} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-muted-foreground">
                  {formatAuthorList(r.authors) || "Unknown author"}
                  {r.year ? ` · ${r.year}` : ""}
                  {r.journal ? ` · ${r.journal}` : ""}
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => handleAdd(r)}
                  disabled={addingDoi === r.doi}
                >
                  {addingDoi === r.doi ? "Adding..." : "Add this one"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualReferenceDialog({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setText("");
      setError(null);
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citation: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.errors?.join(" ") ?? "Couldn't add that reference.");
        return;
      }
      onAdded();
      handleOpenChange(false);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" />
          Add manually
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a reference manually</DialogTitle>
          <DialogDescription>
            For anything the search won&apos;t find — books, chapters, reports, older or
            unindexed work. Paste or type the full citation exactly as you want it to appear.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Smith, J. (2020). Title of the work. Publisher."
        />
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !text.trim()}>
            {saving ? "Adding..." : "Add reference"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The References section of a project's Info tab: an alphabetized (by
// first author) APA-style list, each entry addable either by searching
// Crossref for a title or by pasting a citation in by hand.
export function ReferencesSection({ projectId }: { projectId: string }) {
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/references`)
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setReferences(data.references ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(ref: ProjectReference) {
    setEditingId(ref.id);
    setEditDraft(ref.citation);
  }

  async function saveEdit() {
    if (!editingId || !editDraft.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/references/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citation: editDraft }),
      });
      if (res.ok) {
        setEditingId(null);
        load();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this reference?")) return;
    try {
      await fetch(`/api/projects/${projectId}/references/${id}`, { method: "DELETE" });
      load();
    } catch {
      // Best-effort — worst case it's still there on the next reload.
    }
  }

  return (
    <div className="grid gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : references.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No references yet — search for a paper or add one manually below.
        </p>
      ) : (
        <ol className="grid gap-3">
          {references.map((ref) => (
            <li key={ref.id} className="group">
              {editingId === ref.id ? (
                <div className="grid gap-2">
                  <Textarea
                    rows={3}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editDraft.trim()}>
                      {savingEdit ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      disabled={savingEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="prose prose-sm dark:prose-invert max-w-none -indent-6 pl-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{ref.citation}</ReactMarkdown>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => startEdit(ref)}
                      aria-label="Edit reference"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ref.id)}
                      aria-label="Delete reference"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <SearchPaperDialog projectId={projectId} onAdded={load} />
        <ManualReferenceDialog projectId={projectId} onAdded={load} />
      </div>
    </div>
  );
}
