"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Project } from "@/lib/projects-store";
import { MarkdownEditor } from "./markdown-editor";
import { Button } from "@/components/ui/button";

// One editable markdown section of a project's Info tab (Background,
// Notes — anything stored as a nullable text column on `projects`).
// Three states: empty ("Add <label>" button), viewing (rendered markdown
// + Edit button), and editing (MarkdownEditor + Save/Cancel).
export function MarkdownField({
  projectId,
  fieldKey,
  label,
  value,
  onSaved,
}: {
  projectId: string;
  fieldKey: "background" | "notes";
  label: string;
  value: string | null;
  onSaved: (project: Project) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setDraft(value ?? "");
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.errors?.join(" ") ?? `Couldn't save ${label.toLowerCase()}.`);
        return;
      }
      onSaved(data.project);
      setEditing(false);
    } catch {
      setSaveError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="grid gap-3">
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        <MarkdownEditor projectId={projectId} value={draft} onChange={setDraft} />
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

  if (!value) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Button onClick={startEditing}>Add {label.toLowerCase()}</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={startEditing}>
          Edit
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </div>
  );
}
