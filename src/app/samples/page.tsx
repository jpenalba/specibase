"use client";

import { useEffect, useState } from "react";
import { RawRow } from "@/lib/validation";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { StagingTable, StagedSample } from "@/components/samples/staging-table";
import { AddSampleDialog } from "@/components/samples/add-sample-dialog";
import { TemplateDialog } from "@/components/samples/template-dialog";
import { ImportDialog } from "@/components/samples/import-dialog";
import { FieldPicker } from "@/components/samples/field-picker";
import { ProjectPicker, ProjectSelection } from "@/components/samples/project-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function SamplesPage() {
  const { selected, toggle } = useOptionalFields();
  const [dbIdentifiers, setDbIdentifiers] = useState<string[]>([]);
  const [staged, setStaged] = useState<StagedSample[]>([]);
  const [projectSelection, setProjectSelection] = useState<ProjectSelection>({
    mode: "none",
  });
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/samples/identifiers")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setDbIdentifiers(data.identifiers ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const takenIdentifiers = [
    ...dbIdentifiers,
    ...staged
      .map((s) => s.row.primary_identifier?.trim())
      .filter((id): id is string => Boolean(id)),
  ];

  function stageOne(row: RawRow) {
    setStaged((prev) => [...prev, { clientId: newClientId(), row }]);
    setMessage(null);
  }

  function stageMany(rows: RawRow[]) {
    setStaged((prev) => [
      ...prev,
      ...rows.map((row) => ({ clientId: newClientId(), row })),
    ]);
    setMessage(null);
  }

  function removeStaged(clientId: string) {
    setStaged((prev) => prev.filter((s) => s.clientId !== clientId));
  }

  async function handleUpload() {
    if (staged.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/samples/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: staged.map((s) => s.row),
          projectId: projectSelection.mode === "existing" ? projectSelection.projectId : undefined,
          newProjectName: projectSelection.mode === "new" ? projectSelection.name : undefined,
        }),
      });
      const data = await res.json();

      if (data.duplicateIds?.length > 0) {
        setMessage({
          tone: "error",
          text: `Upload blocked — Sample ID(s) already in the database: ${data.duplicateIds.join(", ")}. Remove them from staging and try again.`,
        });
        return;
      }

      const insertedIds = new Set(
        (data.inserted ?? []).map((s: { primary_identifier: string }) => s.primary_identifier)
      );
      setStaged((prev) => prev.filter((s) => !insertedIds.has(s.row.primary_identifier?.trim())));
      setDbIdentifiers((prev) => [...prev, ...insertedIds] as string[]);

      const projectNote = data.project?.name ? ` and added to project "${data.project.name}"` : "";
      let text = `Uploaded ${insertedIds.size} sample(s)${projectNote}.`;
      if (data.skipped?.length > 0) {
        text += ` ${data.skipped.length} row(s) were skipped — they're still staged below.`;
      }
      setMessage({ tone: "success", text });
    } catch {
      setMessage({ tone: "error", text: "Upload failed — check your connection and try again." });
    } finally {
      setUploading(false);
    }
  }

  const canUpload =
    staged.length > 0 &&
    !uploading &&
    (projectSelection.mode !== "new" || projectSelection.name.trim().length > 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Add samples</h1>
          <p className="text-sm text-muted-foreground">
            A temporary holding space — stage samples here, then upload the
            batch to the database below. {staged.length} sample
            {staged.length === 1 ? "" : "s"} waiting.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDialog takenIdentifiers={takenIdentifiers} onStage={stageMany} />
          <TemplateDialog selected={selected} onToggle={toggle} />
          <AddSampleDialog
            visibleOptionalKeys={selected}
            takenIdentifiers={takenIdentifiers}
            onStage={stageOne}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table columns</CardTitle>
          <CardDescription>
            Tick which optional fields to show here — the same set is used
            for the CSV template.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldPicker selected={selected} onToggle={toggle} />
        </CardContent>
      </Card>

      <StagingTable staged={staged} visibleOptionalKeys={selected} onRemove={removeStaged} />

      <Card>
        <CardHeader>
          <CardTitle>Upload staged batch</CardTitle>
          <CardDescription>
            Nothing above is in the database yet. Choose whether to also
            associate this batch with a project, then upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ProjectPicker selection={projectSelection} onChange={setProjectSelection} />
          {message && (
            <div
              className={
                message.tone === "success"
                  ? "rounded-md border border-border bg-muted p-3 text-sm"
                  : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              }
            >
              {message.text}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={!canUpload}>
            {uploading
              ? "Uploading..."
              : `Upload ${staged.length} sample(s) to database`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
