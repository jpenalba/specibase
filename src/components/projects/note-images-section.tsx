"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { NoteImage } from "@/lib/project-lab-notes-store";
import { SampleRecord } from "@/lib/samples-store";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/image-types";
import { formatTimestampDisplay } from "@/lib/date-format";
import { SamplePicker } from "./sample-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export type NotesKind = "lab" | "bio";

function endpointFor(kind: NotesKind): string {
  return kind === "lab" ? "lab-note-images" : "bio-note-images";
}

// Uploads the file first (the generic per-project image route, same one
// the markdown editor's "insert image" button uses), then records the
// result as its own image entry with its own metadata — same two-step
// pattern as ProtocolDialog's PDF upload.
function AddImageDialog({
  projectId,
  kind,
  onAdded,
}: {
  projectId: string;
  kind: NotesKind;
  onAdded: (image: NoteImage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setNotes("");
    setSelectedIds(new Set());
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("A title is required");
      return;
    }
    if (!file) {
      setError("An image is required");
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError(`Unsupported image type "${file.type || "unknown"}"`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image is too large — max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.errors?.join(" ") ?? "Couldn't upload the image.");
        return;
      }

      const res = await fetch(`/api/projects/${projectId}/${endpointFor(kind)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          notes,
          sample_ids: [...selectedIds],
          image_url: uploadData.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't save the image.");
        return;
      }
      onAdded(data.image);
      setOpen(false);
      reset();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Add image</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add image</DialogTitle>
          <DialogDescription>
            A gel image, trace, or other photo — separate from the notebook entries above. The
            date is logged automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-1.5">
            <Label htmlFor="note-image-title">Title *</Label>
            <Input
              id="note-image-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note-image-file">Image *</Label>
            <input
              id="note-image-file"
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
            />
          </div>
          <SamplePicker selectedIds={selectedIds} onChange={setSelectedIds} />
          <div className="grid gap-1.5">
            <Label htmlFor="note-image-notes">Notes</Label>
            <Textarea
              id="note-image-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional caption or details"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Add image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImageCard({
  image,
  sampleById,
  onOpen,
  onDelete,
}: {
  image: NoteImage;
  sampleById: Map<string, SampleRecord>;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const identifiers = image.sample_ids
    .map((id) => sampleById.get(id)?.primary_identifier)
    .filter((v): v is string => Boolean(v));

  return (
    <div className="grid gap-1.5 rounded-lg border border-border p-2">
      <button
        type="button"
        onClick={onOpen}
        className="overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a
            user-uploaded photo, not a static app asset */}
        <img
          src={image.image_url}
          alt={image.title}
          className="aspect-[4/3] w-full object-cover transition hover:opacity-90"
        />
      </button>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{image.title}</p>
          <p className="text-xs text-muted-foreground">{formatTimestampDisplay(image.created_at)}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${image.title}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {identifiers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {identifiers.map((id) => (
            <span key={id} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {id}
            </span>
          ))}
        </div>
      )}
      {image.notes && <p className="text-xs text-muted-foreground">{image.notes}</p>}
    </div>
  );
}

// Image attachments (gel images, traces, etc.) for a project's Lab or
// Bioinformatic notes tab — shown as its own gallery below the markdown
// notebook, added via its own "Add image" button since an image carries
// structured metadata (title, linked sample(s), a caption) rather than
// living inline in a block's prose. Each thumbnail is capped at a third
// of the gallery's width (three per row) — click one for a full-size view.
export function NoteImagesSection({ projectId, kind }: { projectId: string; kind: NotesKind }) {
  const [images, setImages] = useState<NoteImage[]>([]);
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openImage, setOpenImage] = useState<NoteImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${projectId}/${endpointFor(kind)}`).then((res) => res.json()),
      fetch("/api/samples").then((res) => res.json()),
    ])
      .then(([imagesData, samplesData]) => {
        if (cancelled) return;
        if (imagesData.errors?.length > 0) {
          setError(imagesData.errors.join(" "));
          return;
        }
        setError(null);
        setImages(imagesData.images ?? []);
        setSamples(samplesData.samples ?? []);
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
  }, [projectId, kind]);

  const sampleById = new Map(samples.map((s) => [s.id, s]));

  async function handleDelete(image: NoteImage) {
    if (!window.confirm(`Delete image "${image.title}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/${endpointFor(kind)}/${image.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setImages((prev) => prev.filter((i) => i.id !== image.id));
    } catch {
      setError("Couldn't delete that image — try again.");
    }
  }

  const openIdentifiers = openImage
    ? openImage.sample_ids.map((id) => sampleById.get(id)?.primary_identifier).filter((v): v is string => Boolean(v))
    : [];

  return (
    <div className="grid gap-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Images</h3>
        <AddImageDialog
          projectId={projectId}
          kind={kind}
          onAdded={(image) => setImages((prev) => [image, ...prev])}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No images yet — gel images, traces, or other photos can go here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              sampleById={sampleById}
              onOpen={() => setOpenImage(image)}
              onDelete={() => handleDelete(image)}
            />
          ))}
        </div>
      )}

      <Dialog open={openImage !== null} onOpenChange={(next) => !next && setOpenImage(null)}>
        <DialogContent className="max-w-3xl">
          {openImage && (
            <>
              <DialogHeader>
                <DialogTitle>{openImage.title}</DialogTitle>
                <DialogDescription>{formatTimestampDisplay(openImage.created_at)}</DialogDescription>
              </DialogHeader>
              {/* eslint-disable-next-line @next/next/no-img-element -- a
                  user-uploaded photo, not a static app asset */}
              <img
                src={openImage.image_url}
                alt={openImage.title}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
              {openIdentifiers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {openIdentifiers.map((id) => (
                    <span key={id} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      {id}
                    </span>
                  ))}
                </div>
              )}
              {openImage.notes && <p className="text-sm text-muted-foreground">{openImage.notes}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
