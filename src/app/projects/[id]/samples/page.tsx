"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { SampleRecord } from "@/lib/samples-store";
import { RawRow } from "@/lib/validation";
import { getVisibleColumns } from "@/lib/fields";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { FocalGroupIcon } from "@/components/projects/focal-group-icon";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { SamplePicker } from "@/components/projects/sample-picker";
import { AddSampleDialog } from "@/components/samples/add-sample-dialog";
import { ImportDialog } from "@/components/samples/import-dialog";
import { StagingTable, StagedSample } from "@/components/samples/staging-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function ProjectSamplesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { selected: visibleOptionalKeys } = useOptionalFields();
  const [project, setProject] = useState<Project | null>(null);
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staged, setStaged] = useState<StagedSample[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );

  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);

  // Reused after every mutation (link, unlink, upload) rather than
  // patching local state in place — the projects/samples endpoints
  // already return everything needed for a full, consistent refetch.
  const load = useCallback(() => {
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/samples").then((res) => res.json()),
    ])
      .then(([projectsData, samplesData]) => {
        if (projectsData.errors?.length > 0) {
          setError(projectsData.errors.join(" "));
          return;
        }
        setError(null);
        const found =
          (projectsData.projects ?? []).find((p: Project) => p.id === projectId) ?? null;
        setProject(found);
        setLinks(projectsData.links ?? []);
        setSamples(samplesData.samples ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const linkedSampleIds = useMemo(
    () => new Set(links.filter((l) => l.project_id === projectId).map((l) => l.sample_id)),
    [links, projectId]
  );
  const linkedSamples = useMemo(
    () => samples.filter((s) => linkedSampleIds.has(s.id)),
    [samples, linkedSampleIds]
  );

  const takenIdentifiers = [
    ...samples.map((s) => s.primary_identifier),
    ...staged
      .map((s) => s.row.primary_identifier?.trim())
      .filter((id): id is string => Boolean(id)),
  ];

  function stageOne(row: RawRow) {
    setStaged((prev) => [...prev, { clientId: newClientId(), row }]);
    setMessage(null);
  }

  function stageMany(rows: RawRow[]) {
    setStaged((prev) => [...prev, ...rows.map((row) => ({ clientId: newClientId(), row }))]);
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
        body: JSON.stringify({ rows: staged.map((s) => s.row), projectId }),
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

      let text = `Uploaded ${insertedIds.size} sample(s).`;
      if (data.skipped?.length > 0) {
        text += ` ${data.skipped.length} row(s) were skipped — they're still staged below.`;
      }
      if (data.errors?.length > 0) {
        text += ` ${data.errors.join(" ")}`;
      }
      setMessage({ tone: data.errors?.length > 0 ? "error" : "success", text });
      load();
    } catch {
      setMessage({ tone: "error", text: "Upload failed — check your connection and try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleLinkSelected() {
    if (addSelection.size === 0) return;
    setLinking(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [...addSelection] }),
      });
      if (res.ok) {
        setAddSelection(new Set());
        load();
      } else {
        setMessage({ tone: "error", text: "Couldn't link the selected samples." });
      }
    } catch {
      setMessage({ tone: "error", text: "Couldn't reach the server." });
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(sampleId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/samples`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [sampleId] }),
      });
      if (res.ok) {
        load();
      } else {
        setMessage({ tone: "error", text: "Couldn't remove that sample from the project." });
      }
    } catch {
      setMessage({ tone: "error", text: "Couldn't reach the server." });
    }
  }

  const columns = getVisibleColumns(visibleOptionalKeys);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground sm:p-10">Loading...</div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl p-6 sm:p-10">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to projects
        </Link>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? "Project not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to projects
      </Link>

      <div className="flex items-start gap-3">
        <FocalGroupIcon focalGroup={project.focal_group} logo={project.logo} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Linked samples</CardTitle>
          <CardDescription>
            {linkedSamples.length} sample{linkedSamples.length === 1 ? "" : "s"} in this
            project. Removing one only unlinks it here — it stays in the main database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedSamples.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No samples linked yet. Add some below.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      {columns.map((col) => (
                        <TableCell key={col.key}>
                          {sample[col.key] ? (
                            String(sample[col.key])
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(sample.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add from the main database</CardTitle>
          <CardDescription>
            Search for samples already in the database and link them to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SamplePicker
            selectedIds={addSelection}
            onChange={setAddSelection}
            excludeIds={linkedSampleIds}
          />
        </CardContent>
        <CardFooter>
          <Button onClick={handleLinkSelected} disabled={addSelection.size === 0 || linking}>
            {linking ? "Linking..." : `Link ${addSelection.size} sample(s)`}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Add new samples</CardTitle>
            <CardDescription>
              Stage new samples here, then upload — same as the Add samples page, but linked
              to this project automatically.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportDialog takenIdentifiers={takenIdentifiers} onStage={stageMany} />
            <AddSampleDialog
              visibleOptionalKeys={visibleOptionalKeys}
              takenIdentifiers={takenIdentifiers}
              onStage={stageOne}
            />
          </div>
        </CardHeader>
        <CardContent>
          <StagingTable staged={staged} visibleOptionalKeys={visibleOptionalKeys} onRemove={removeStaged} />
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={staged.length === 0 || uploading}>
            {uploading ? "Uploading..." : `Upload ${staged.length} sample(s) to database`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
