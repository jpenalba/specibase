"use client";

import { useState } from "react";
import { parseDDMMYYYY, DATE_FORMAT_LABEL } from "@/lib/dates";
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
  startDate: string;
  owner: string;
  collaborators: string;
  focalGroup: string;
  focalRegion: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  startDate: "",
  owner: "",
  collaborators: "",
  focalGroup: "",
  focalRegion: "",
};

export function AddProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setErrors(["Project name is required"]);
      return;
    }
    let startDateIso: string | undefined;
    if (values.startDate.trim()) {
      const parsed = parseDDMMYYYY(values.startDate);
      if (!parsed) {
        setErrors([`Start date must be in ${DATE_FORMAT_LABEL} format`]);
        return;
      }
      startDateIso = parsed;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: values.description,
          start_date: startDateIso ?? "",
          owner: values.owner,
          collaborators: values.collaborators,
          focal_group: values.focalGroup,
          focal_region: values.focalRegion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Couldn't create the project."]);
        return;
      }
      setValues(EMPTY_FORM);
      setOpen(false);
      onCreated();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setErrors([]);
      }}
    >
      <DialogTrigger asChild>
        <Button>Add project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>
            Set up a new project. You can link samples to it from the samples
            page or database.
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
            <Label htmlFor="project-name">Project name *</Label>
            <Input
              id="project-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="project-description">Short description</Label>
            <Textarea
              id="project-description"
              rows={2}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-start-date">Start date</Label>
              <Input
                id="project-start-date"
                placeholder={DATE_FORMAT_LABEL}
                value={values.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-owner">Owner</Label>
              <Input
                id="project-owner"
                value={values.owner}
                onChange={(e) => update("owner", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="project-collaborators">Collaborators</Label>
            <Input
              id="project-collaborators"
              placeholder="Comma-separated, e.g. Jane Doe, John Smith"
              value={values.collaborators}
              onChange={(e) => update("collaborators", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-focal-group">Focal species/group</Label>
              <Input
                id="project-focal-group"
                value={values.focalGroup}
                onChange={(e) => update("focalGroup", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-focal-region">Focal region</Label>
              <Input
                id="project-focal-region"
                value={values.focalRegion}
                onChange={(e) => update("focalRegion", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
