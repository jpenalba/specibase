"use client";

import { useState } from "react";
import { FieldPicker } from "./field-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TemplateDialog({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Download template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download CSV template</DialogTitle>
          <DialogDescription>
            Sample ID, species, latitude, and longitude are always included.
            Tick any other columns your lab wants in the template — this is
            the same set shown in the table, and you can change it any time.
          </DialogDescription>
        </DialogHeader>
        <FieldPicker selected={selected} onToggle={onToggle} />
        <DialogFooter>
          <Button asChild>
            <a href={`/api/samples/template?fields=${selected.join(",")}`}>
              Download template.csv
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
