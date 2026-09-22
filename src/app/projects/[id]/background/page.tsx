"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Project } from "@/lib/projects-store";
import { ALLOWED_IMAGE_TYPES } from "@/lib/image-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ProjectBackgroundPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setProject((data.projects ?? []).find((p: Project) => p.id === projectId) ?? null);
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

  function startEditing() {
    setDraft(project?.background ?? "");
    setSaveError(null);
    setUploadError(null);
    setEditing(true);
  }

  // Inserts at the textarea's current cursor position (falling back to
  // appending if the ref isn't available yet) rather than always at the
  // end, so dropping an image in mid-paragraph lands where the cursor was.
  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    setDraft(next);
    const cursor = start + text.length;
    // Restore focus/cursor after React re-renders the textarea with the
    // new value — setting it in the same tick would be overwritten.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires a change event.
    e.target.value = "";
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/background/images`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.errors?.join(" ") ?? "Couldn't upload the image.");
        return;
      }
      insertAtCursor(`![](${data.url})`);
    } catch {
      setUploadError("Couldn't reach the server.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.errors?.join(" ") ?? "Couldn't save the background.");
        return;
      }
      setProject(data.project);
      setEditing(false);
    } catch {
      setSaveError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading...</p>;
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Project not found."}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-3">
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            {uploadingImage ? "Uploading..." : "Insert image"}
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          rows={16}
          className="font-mono"
          placeholder="Write in Markdown — headings, lists, links, images..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
    );
  }

  if (!project.background) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Button onClick={startEditing}>Add background</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={startEditing}>
          Edit
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.background}</ReactMarkdown>
      </div>
    </div>
  );
}
