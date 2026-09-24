"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Protocol } from "@/lib/protocols-store";
import {
  PROTOCOL_TYPES,
  PROTOCOL_TYPE_LABELS,
  ProtocolType,
  ProtocolSourceType,
} from "@/lib/protocol-types";
import { ALLOWED_PROTOCOL_FILE_TYPES, MAX_PROTOCOL_PDF_BYTES } from "@/lib/protocol-files";
import { parseDDMMYYYY, DATE_FORMAT_LABEL, formatToDDMMYYYY } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type FormState = {
  name: string;
  description: string;
  dateAdded: string;
  protocolType: ProtocolType;
  sourceType: ProtocolSourceType;
};

function todayDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${now.getFullYear()}`;
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    dateAdded: todayDDMMYYYY(),
    protocolType: "other",
    sourceType: "pdf",
  };
}

function formFromProtocol(protocol: Protocol): FormState {
  return {
    name: protocol.name,
    description: protocol.description ?? "",
    dateAdded: formatToDDMMYYYY(protocol.date_added),
    protocolType: protocol.protocol_type,
    sourceType: protocol.source_type,
  };
}

// Handles both creating a new protocol (no `protocol` prop, POSTs) and
// editing an existing one (PATCHes) — same shape as CollectionDialog. A
// PDF is uploaded separately, ahead of the protocol record itself (see
// uploadProtocolPdf), since the record doesn't exist yet on create.
export function ProtocolDialog({
  protocol,
  onSaved,
  trigger,
}: {
  protocol?: Protocol;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const isEdit = Boolean(protocol);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormState>(() =>
    protocol ? formFromProtocol(protocol) : emptyForm()
  );
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(protocol ? formFromProtocol(protocol) : emptyForm());
      setFile(null);
      setErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setErrors(["Protocol name is required"]);
      return;
    }
    const dateAddedIso = parseDDMMYYYY(values.dateAdded);
    if (!dateAddedIso) {
      setErrors([`Date added must be in ${DATE_FORMAT_LABEL} format`]);
      return;
    }
    const keepsExistingPdf =
      isEdit && protocol!.source_type === "pdf" && values.sourceType === "pdf" && !file;
    if (values.sourceType === "pdf" && !file && !keepsExistingPdf) {
      setErrors(["Upload a PDF for this protocol"]);
      return;
    }
    if (file) {
      if (!ALLOWED_PROTOCOL_FILE_TYPES.includes(file.type)) {
        setErrors(["Only PDF files are supported"]);
        return;
      }
      if (file.size > MAX_PROTOCOL_PDF_BYTES) {
        setErrors([`File is too large — max ${Math.floor(MAX_PROTOCOL_PDF_BYTES / (1024 * 1024))}MB`]);
        return;
      }
    }

    setSubmitting(true);
    setErrors([]);
    try {
      let pdfUrl = keepsExistingPdf ? protocol!.pdf_url ?? "" : "";
      let pdfFilename = keepsExistingPdf ? protocol!.pdf_filename ?? "" : "";
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/protocols/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setErrors(uploadData.errors ?? ["Couldn't upload the file."]);
          return;
        }
        pdfUrl = uploadData.url;
        pdfFilename = uploadData.filename;
      }

      const url = protocol ? `/api/protocols/${protocol.id}` : "/api/protocols";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: values.description,
          date_added: dateAddedIso,
          protocol_type: values.protocolType,
          source_type: values.sourceType,
          pdf_url: pdfUrl,
          pdf_filename: pdfFilename,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [`Couldn't ${isEdit ? "save" : "create"} the protocol.`]);
        return;
      }
      setOpen(false);
      if (!isEdit && values.sourceType === "built") {
        // Straight into the builder page the user just asked for, rather
        // than back to the list — there's nothing to see there yet for a
        // protocol with no content.
        router.push(`/protocols/${data.protocol.id}`);
      } else {
        onSaved();
      }
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit protocol" : "Add protocol"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this protocol's details."
              : "Upload a ready-made PDF, or build the protocol directly in Specibase."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="protocol-name">Protocol name *</Label>
            <Input
              id="protocol-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="protocol-type">Protocol type *</Label>
              <select
                id="protocol-type"
                value={values.protocolType}
                onChange={(e) => update("protocolType", e.target.value as ProtocolType)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PROTOCOL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PROTOCOL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="protocol-date-added">Date added *</Label>
              <Input
                id="protocol-date-added"
                placeholder={DATE_FORMAT_LABEL}
                value={values.dateAdded}
                onChange={(e) => update("dateAdded", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="protocol-description">Short description</Label>
            <Input
              id="protocol-description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Content *</Label>
            <div className="flex gap-2">
              {(["pdf", "built"] as ProtocolSourceType[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => update("sourceType", source)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs",
                    values.sourceType === source
                      ? "border-foreground bg-accent"
                      : "border-input hover:bg-accent"
                  )}
                >
                  {source === "pdf" ? "Upload PDF" : "Build in Specibase"}
                </button>
              ))}
            </div>
          </div>

          {values.sourceType === "pdf" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="protocol-file">
                {isEdit && protocol?.pdf_filename ? "Replace PDF" : "PDF file *"}
              </Label>
              <input
                id="protocol-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
              />
              {isEdit && protocol?.source_type === "pdf" && protocol.pdf_filename && !file && (
                <p className="text-xs text-muted-foreground">
                  Currently: {protocol.pdf_filename} — choose a new file to replace it.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              {isEdit
                ? "This protocol's content is written on its own page — open it from the Protocols list to edit."
                : "You'll be taken to a page to start writing this protocol's content once it's created."}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save changes"
                  : "Create protocol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
