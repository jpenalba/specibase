"use client";

import { useState } from "react";
import { Collection } from "@/lib/collections-store";
import { parseDDMMYYYY, DATE_FORMAT_LABEL, formatToDDMMYYYY } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type FormState = {
  name: string;
  description: string;
  dateAdded: string;
  focalGroup: string;
  location: string;
  contacts: string;
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
    // Defaults to today, per the brief — still a plain editable field if
    // the collection was actually added to the tracker on a different day.
    dateAdded: todayDDMMYYYY(),
    focalGroup: "",
    location: "",
    contacts: "",
  };
}

function formFromCollection(collection: Collection): FormState {
  return {
    name: collection.name,
    description: collection.description ?? "",
    dateAdded: formatToDDMMYYYY(collection.date_added),
    focalGroup: collection.focal_group ?? "",
    location: collection.location ?? "",
    contacts: collection.contacts ?? "",
  };
}

// Handles both creating a new collection (no `collection` prop, POSTs) and
// editing an existing one (PATCHes) — same shape as ProjectDialog.
export function CollectionDialog({
  collection,
  onSaved,
  onCreated,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  collection?: Collection;
  onSaved: () => void;
  onCreated?: (collection: Collection) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(collection);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [values, setValues] = useState<FormState>(() =>
    collection ? formFromCollection(collection) : emptyForm()
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setOpen(next: boolean) {
    if (onOpenChangeProp) onOpenChangeProp(next);
    else setInternalOpen(next);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(collection ? formFromCollection(collection) : emptyForm());
      setErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setErrors(["Collection name is required"]);
      return;
    }
    const dateAddedIso = parseDDMMYYYY(values.dateAdded);
    if (!dateAddedIso) {
      setErrors([`Date added must be in ${DATE_FORMAT_LABEL} format`]);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const url = collection ? `/api/collections/${collection.id}` : "/api/collections";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: values.description,
          date_added: dateAddedIso,
          focal_group: values.focalGroup,
          location: values.location,
          contacts: values.contacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [`Couldn't ${isEdit ? "save" : "create"} the collection.`]);
        return;
      }
      setOpen(false);
      onSaved();
      if (!isEdit) onCreated?.(data.collection);
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit collection" : "Add collection"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this collection's details."
              : "Track an external collection — a museum's, a collaborator's, or anything else that isn't part of the main database."}
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
            <Label htmlFor="collection-name">Collection name *</Label>
            <Input
              id="collection-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="collection-description">Collection description</Label>
            <Textarea
              id="collection-description"
              rows={2}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="collection-date-added">Date added *</Label>
              <Input
                id="collection-date-added"
                placeholder={DATE_FORMAT_LABEL}
                value={values.dateAdded}
                onChange={(e) => update("dateAdded", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="collection-focal-group">Focal species/group</Label>
              <Input
                id="collection-focal-group"
                value={values.focalGroup}
                onChange={(e) => update("focalGroup", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="collection-location">Collection location</Label>
            <Input
              id="collection-location"
              value={values.location}
              onChange={(e) => update("location", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="collection-contacts">Relevant contact(s)</Label>
            <Input
              id="collection-contacts"
              placeholder="Comma-separated, e.g. Jane Doe, Field Museum"
              value={values.contacts}
              onChange={(e) => update("contacts", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save changes"
                  : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
