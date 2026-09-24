"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Image as ImageIcon,
} from "lucide-react";
import { ALLOWED_IMAGE_TYPES } from "@/lib/image-types";
import { Textarea } from "@/components/ui/textarea";

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
    >
      <Icon className="size-4" />
    </button>
  );
}

// A plain textarea plus a toolbar of the standard markdown formatting
// buttons (heading, bold, italic, quote, code, link, lists, image) — for
// anyone editing a project's Background/Notes who doesn't already know
// markdown syntax by hand. Every button acts on the textarea's current
// selection/cursor, not just appends to the end.
export function MarkdownEditor({
  value,
  onChange,
  uploadUrl,
  rows = 14,
}: {
  value: string;
  onChange: (value: string) => void;
  // Where the image toolbar button POSTs a selected file — e.g.
  // `/api/projects/${projectId}/images` or `/api/protocols/${id}/images`.
  // Kept generic rather than a projectId prop so this editor can be reused
  // anywhere markdown content is edited, not just a project's Info tab.
  uploadUrl: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function getSelection() {
    const el = textareaRef.current;
    if (!el) return { start: value.length, end: value.length };
    return { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length };
  }

  // Applies `next`, then restores focus and selects [selStart, selEnd) —
  // has to happen a tick after the state update, since setting it in the
  // same tick would be overwritten once React re-renders the textarea
  // with the new value.
  function apply(next: string, selStart: number, selEnd: number) {
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  // Wraps the selection with prefix/suffix (e.g. "**"/"**" for bold). With
  // nothing selected, inserts a placeholder and selects it so typing
  // immediately replaces it instead of leaving stray asterisks behind.
  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    const { start, end } = getSelection();
    const text = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + prefix + text + suffix + value.slice(end);
    apply(next, start + prefix.length, start + prefix.length + text.length);
  }

  // Prefixes every line the current selection touches (or just the
  // current line, with nothing selected) — used for headings, quotes,
  // and both list styles, which are all "one marker per line" in markdown.
  function prefixLines(prefix: string) {
    const { start, end } = getSelection();
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const block = value.slice(lineStart, lineEnd);
    const withPrefix = block
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
    const next = value.slice(0, lineStart) + withPrefix + value.slice(lineEnd);
    apply(next, lineStart, lineStart + withPrefix.length);
  }

  function insertLink() {
    const { start, end } = getSelection();
    const label = value.slice(start, end) || "link text";
    const inserted = `[${label}](url)`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    // Selects just the "url" placeholder, since the label is usually
    // already right (either typed text or the default) and the URL is
    // the part that actually needs filling in.
    const urlStart = start + label.length + 3;
    apply(next, urlStart, urlStart + 3);
  }

  function insertImageMarkdown(url: string) {
    const { start, end } = getSelection();
    const inserted = `![](${url})`;
    const next = value.slice(0, start) + inserted + value.slice(end);
    // Cursor lands between the [] so a caption can be typed right away;
    // nothing to select since alt text starts empty.
    const altPos = start + 2;
    apply(next, altPos, altPos);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingImage(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.errors?.join(" ") ?? "Couldn't upload the image.");
        return;
      }
      insertImageMarkdown(data.url);
    } catch {
      setUploadError("Couldn't reach the server.");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-input p-1">
        <ToolbarButton icon={Heading2} label="Heading" onClick={() => prefixLines("## ")} />
        <ToolbarButton icon={Bold} label="Bold" onClick={() => wrapSelection("**", "**", "bold text")} />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          onClick={() => wrapSelection("*", "*", "italic text")}
        />
        <ToolbarButton icon={Quote} label="Quote" onClick={() => prefixLines("> ")} />
        <ToolbarButton icon={Code} label="Code" onClick={() => wrapSelection("`", "`", "code")} />
        <ToolbarButton icon={LinkIcon} label="Link" onClick={insertLink} />
        <ToolbarButton icon={List} label="Bulleted list" onClick={() => prefixLines("- ")} />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          onClick={() => prefixLines("1. ")}
        />
        <ToolbarButton
          icon={ListChecks}
          label="Task list"
          onClick={() => prefixLines("- [ ] ")}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={handleFileSelected}
        />
        <ToolbarButton
          icon={ImageIcon}
          label={uploadingImage ? "Uploading..." : "Insert image"}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
        />
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      <Textarea
        ref={textareaRef}
        rows={rows}
        className="font-mono"
        placeholder="Write in Markdown — headings, lists, links, images..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
