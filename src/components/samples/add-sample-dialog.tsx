"use client";

import { useState } from "react";
import { REQUIRED_FIELDS, optionalFieldByKey } from "@/lib/fields";
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

export function AddSampleDialog({
  visibleOptionalKeys,
  onCreated,
}: {
  visibleOptionalKeys: string[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const optionalFields = visibleOptionalKeys
    .map((key) => optionalFieldByKey(key))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong"]);
        return;
      }
      setValues({});
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add sample</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add sample</DialogTitle>
          <DialogDescription>
            Sample ID, species, and coordinates are required. Other fields
            shown here match the columns currently visible in the table.
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
          <div className="grid grid-cols-2 gap-3">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={field.key}>{field.label} *</Label>
                <Input
                  id={field.key}
                  type={field.type === "number" ? "number" : "text"}
                  step={field.type === "number" ? "any" : undefined}
                  required
                  value={values[field.key] ?? ""}
                  onChange={(e) => update(field.key, e.target.value)}
                />
              </div>
            ))}
            {optionalFields.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => update(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save sample"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
