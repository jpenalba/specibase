"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import { Project } from "@/lib/projects-store";
import { ProjectReference } from "@/lib/project-references-store";
import { SampleRecord } from "@/lib/samples-store";
import { SampleProjectLink } from "@/lib/projects-store";
import { MarkerStyle } from "@/lib/project-marker-styles-store";
import { BioNotesBlock } from "@/lib/project-bio-notes-store";
import { LabNotesBlock, NoteImage } from "@/lib/project-lab-notes-store";
import { LabWorkflow, LabWorkflowDetailColumn, LabWorkflowDetailRow, LabWorkflowDetailValue } from "@/lib/lab-workflows-store";
import { BioWorkflow } from "@/lib/bio-workflows-store";
import { buildProjectMapLayer } from "@/lib/marker-style";
import { MAIN_DATABASE_COLOR, hexToRgb, strokeColorFor } from "@/lib/layer-colors";
import { DEFAULT_LAYER_SHAPE, LayerShape, shapePolygonPoints } from "@/lib/layer-shapes";
import { DEFAULT_OPTIONAL_KEYS, getVisibleColumns } from "@/lib/fields";
import { renderMarkdownToPdf, renderParagraph } from "@/lib/markdown-pdf";
import { detailTableToAutoTableRows, samplesToAutoTableRows } from "@/lib/csv";
import { formatTimestampDisplay } from "@/lib/date-format";
import { formatToDDMMYYYY } from "@/lib/dates";
import { parseCollaborators } from "@/lib/collaborators";
import { SampleMap, SampleMapHandle, CapturedMapImage } from "@/components/database/sample-map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Orientation = "portrait" | "landscape";
type WorkflowChoice = { id: string; name: string; included: boolean; orientation: Orientation };

function OrientationToggle({
  value,
  onChange,
}: {
  value: Orientation;
  onChange: (value: Orientation) => void;
}) {
  return (
    <div className="flex w-fit overflow-hidden rounded-md border border-input text-xs">
      {(["portrait", "landscape"] as Orientation[]).map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "px-2 py-1 capitalize",
            value === o ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function WorkflowChoiceRow({
  choice,
  onToggle,
  onSetOrientation,
}: {
  choice: WorkflowChoice;
  onToggle: () => void;
  onSetOrientation: (o: Orientation) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Checkbox checked={choice.included} onCheckedChange={onToggle} />
        <span className="truncate">{choice.name}</span>
      </label>
      {choice.included && <OrientationToggle value={choice.orientation} onChange={onSetOrientation} />}
    </div>
  );
}

// Adds a fresh page in the given orientation and returns its usable
// content box — every section starts on its own page, since a project
// export mixes portrait (text sections) and landscape (wide workflow
// tables) pages and reusing a page's leftover space across a mismatched
// orientation switch isn't meaningful.
function startSection(doc: jsPDF, orientation: Orientation, margin: number) {
  doc.addPage("a4", orientation);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  return { pageWidth, pageHeight, maxWidth: pageWidth - margin * 2 };
}

function drawLegend(
  doc: jsPDF,
  legend: { label: string; color: string; shape: LayerShape; count: number }[],
  gbifLabels: string[],
  margin: number,
  startY: number
): number {
  let y = startY;
  doc.setFontSize(9);
  const markerSize = 8;
  for (const entry of legend) {
    const [r, g, b] = hexToRgb(entry.color);
    doc.setFillColor(r, g, b);
    // A stroke around the swatch, not just a fill — a white or pale
    // legend color would otherwise disappear into the page.
    const [sr, sg, sb] = hexToRgb(strokeColorFor(entry.color));
    doc.setDrawColor(sr, sg, sb);
    doc.setLineWidth(0.5);
    const cx = margin + 4;
    const cy = y - 3;
    if (entry.shape === "circle") {
      doc.circle(cx, cy, markerSize / 2, "FD");
    } else {
      const half = markerSize / 2;
      const points = shapePolygonPoints(entry.shape, markerSize, 0)!.map(
        ([px, py]) => [cx - half + px, cy - half + py] as [number, number]
      );
      const deltas = points.slice(1).map(([px, py], i) => [px - points[i][0], py - points[i][1]]);
      doc.lines(deltas, points[0][0], points[0][1], [1, 1], "FD", true);
    }
    doc.setTextColor(30, 30, 30);
    doc.text(`${entry.label} (${entry.count})`, margin + 14, y);
    y += 14;
  }
  for (const label of gbifLabels) {
    doc.setTextColor(30, 30, 30);
    doc.text(label, margin + 14, y);
    y += 14;
  }
  return y;
}

// Fetches a note image's already-uploaded remote URL and converts it to a
// data URL jsPDF's addImage can embed, plus its natural size for scaling —
// unlike the Samples map (a live canvas capture), these come from Supabase
// storage, so they need fetch()+FileReader instead of an imperative ref.
async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Couldn't load image"));
      img.src = dataUrl;
    });
    return { dataUrl, width, height };
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): string {
  const type = /^data:image\/(\w+);/.exec(dataUrl)?.[1]?.toUpperCase() ?? "PNG";
  return type === "JPG" ? "JPEG" : type;
}

// Compiles a project's tabs into one PDF, letting the user pick which
// sections to include — and, for a Lab/Bioinformatic workflow's full
// Detailed table, whether that section's pages are portrait or landscape.
export function ProjectExportDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [labWorkflows, setLabWorkflows] = useState<WorkflowChoice[]>([]);
  const [bioWorkflows, setBioWorkflows] = useState<WorkflowChoice[]>([]);
  const [includeInfo, setIncludeInfo] = useState(true);
  const [includeSamples, setIncludeSamples] = useState(true);
  const [includeLabNotes, setIncludeLabNotes] = useState(true);
  const [includeBioNotes, setIncludeBioNotes] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapHandleRef = useRef<SampleMapHandle>(null);
  // Mounts a hidden, off-screen SampleMap only while compiling with
  // Samples checked — it needs a real (if invisible) size to render tiles
  // and markers into, so it can't be display:none.
  const [mapExportProps, setMapExportProps] = useState<{
    samples: SampleRecord[];
    layer: ReturnType<typeof buildProjectMapLayer>;
  } | null>(null);

  // Polls for the hidden map's ref to become available after mounting it —
  // a state update made outside a React event handler (as this dialog's
  // async compile flow does) isn't guaranteed to have flushed/committed by
  // the very next line, so waiting a fixed single tick isn't reliable.
  async function waitForMapHandle(timeoutMs = 8000): Promise<SampleMapHandle | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (mapHandleRef.current) return mapHandleRef.current;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return mapHandleRef.current;
  }

  // loadingLists starts true and is never reset back to true on a later
  // open — same convention as the Samples page's own load() — so this
  // stays a plain callback with no synchronous setState before the fetch.
  const loadWorkflowLists = useCallback(() => {
    Promise.all([
      fetch(`/api/lab-workflows?projectId=${projectId}`).then((res) => res.json()),
      fetch(`/api/bio-workflows?projectId=${projectId}`).then((res) => res.json()),
    ])
      .then(([labData, bioData]) => {
        setError(null);
        setLabWorkflows(
          (labData.workflows ?? []).map((w: LabWorkflow) => ({
            id: w.id,
            name: w.name,
            included: true,
            orientation: "portrait" as Orientation,
          }))
        );
        setBioWorkflows(
          (bioData.workflows ?? []).map((w: BioWorkflow) => ({
            id: w.id,
            name: w.name,
            included: true,
            orientation: "portrait" as Orientation,
          }))
        );
      })
      .catch(() => setError("Couldn't load this project's workflows."))
      .finally(() => setLoadingLists(false));
  }, [projectId]);

  useEffect(() => {
    if (open) loadWorkflowLists();
  }, [open, loadWorkflowLists]);

  function toggleWorkflow(list: WorkflowChoice[], setList: (l: WorkflowChoice[]) => void, id: string) {
    setList(list.map((w) => (w.id === id ? { ...w, included: !w.included } : w)));
  }

  function setWorkflowOrientation(
    list: WorkflowChoice[],
    setList: (l: WorkflowChoice[]) => void,
    id: string,
    orientation: Orientation
  ) {
    setList(list.map((w) => (w.id === id ? { ...w, orientation } : w)));
  }

  // Mounts the hidden map, waits for it to settle, captures it, then
  // unmounts it — nothing about it is ever visible to the user.
  async function captureSampleMap(): Promise<CapturedMapImage | null> {
    const [samplesData, projectsData, markerStylesData] = await Promise.all([
      fetch("/api/samples").then((res) => res.json()),
      fetch("/api/projects").then((res) => res.json()),
      fetch(`/api/projects/${projectId}/marker-styles`).then((res) => res.json()),
    ]);
    const project = (projectsData.projects ?? []).find((p: Project) => p.id === projectId) as
      | Project
      | undefined;
    const links = (projectsData.links ?? []) as SampleProjectLink[];
    const linkedSampleIds = new Set(links.filter((l) => l.project_id === projectId).map((l) => l.sample_id));
    const samples = (samplesData.samples ?? []) as SampleRecord[];
    const tableSamples = samples.filter((s) => linkedSampleIds.has(s.id));
    const markerStyles = (markerStylesData.styles ?? []) as MarkerStyle[];

    const layer = buildProjectMapLayer(
      projectId,
      tableSamples,
      linkedSampleIds,
      project?.marker_style_field ?? null,
      project?.marker_color ?? MAIN_DATABASE_COLOR,
      project?.marker_shape ?? DEFAULT_LAYER_SHAPE,
      markerStyles
    );

    setMapExportProps({ samples: tableSamples, layer });
    // setMapExportProps triggers a render outside any event handler, so
    // there's no guarantee it's flushed and committed by the time this
    // async function's next line runs — poll for the ref rather than
    // assuming one microtask/tick is enough (a single missed tick here is
    // exactly what used to make this silently resolve to "couldn't
    // capture the map").
    const handle = await waitForMapHandle();
    if (!handle) {
      setMapExportProps(null);
      return null;
    }
    await handle.waitUntilIdle();
    const captured = await handle.captureMapImage();
    setMapExportProps(null);
    return captured;
  }

  async function compile() {
    setCompiling(true);
    setError(null);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 40;

      const projectsData = await fetch("/api/projects").then((res) => res.json());
      const project = (projectsData.projects ?? []).find((p: Project) => p.id === projectId) as
        | Project
        | undefined;
      if (!project) throw new Error("Project not found");

      // Title + metadata lead straight into the Info section on this same
      // first page — no separate, mostly-blank cover page.
      let pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(project.name, margin, margin + 10);
      doc.setFont("helvetica", "normal");

      let y = margin + 32;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Exported ${new Date().toLocaleString()}`, margin, y);
      doc.setTextColor(0);
      y += 18;

      const metaLines: string[] = [
        `Status: ${project.status === "completed" ? "Completed" : "In progress"}`,
      ];
      if (project.start_date) metaLines.push(`Start date: ${formatToDDMMYYYY(project.start_date)}`);
      if (project.owner) metaLines.push(`Owner: ${project.owner}`);
      if (project.focal_group) metaLines.push(`Focal species/group: ${project.focal_group}`);
      if (project.focal_region) metaLines.push(`Focal region: ${project.focal_region}`);
      const collaborators = parseCollaborators(project.collaborators);
      if (collaborators.length > 0) metaLines.push(`Collaborators: ${collaborators.join(", ")}`);

      doc.setFontSize(10);
      for (const line of metaLines) {
        if (y + 14 > pageHeight - margin) {
          doc.addPage("a4", "portrait");
          pageHeight = doc.internal.pageSize.getHeight();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      y += 8;
      doc.setDrawColor(210);
      doc.line(margin, y, margin + maxWidth, y);
      doc.setDrawColor(0);
      y += 24;

      if (includeInfo) {
        const mdOpts = { x: margin, maxWidth, pageHeight, marginBottom: margin };

        function heading(title: string) {
          if (y + 24 > pageHeight - margin) {
            doc.addPage("a4", "portrait");
            y = margin;
          }
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(title, margin, y);
          doc.setFont("helvetica", "normal");
          y += 12;
        }

        function sub(title: string) {
          if (y + 20 > pageHeight - margin) {
            doc.addPage("a4", "portrait");
            y = margin;
          }
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text(title, margin, y);
          doc.setFont("helvetica", "normal");
          y += 18;
        }

        heading("Info");
        y += 8;

        sub("Background");
        if (project.background) {
          y = renderMarkdownToPdf(doc, project.background, y, mdOpts) + 14;
        } else {
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("Nothing written yet.", margin, y);
          doc.setTextColor(0);
          y += 20;
        }

        sub("Notes");
        if (project.notes) {
          y = renderMarkdownToPdf(doc, project.notes, y, mdOpts) + 14;
        } else {
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("Nothing written yet.", margin, y);
          doc.setTextColor(0);
          y += 20;
        }

        sub("References");
        const referencesData = await fetch(`/api/projects/${projectId}/references`).then((res) => res.json());
        const references = (referencesData.references ?? []) as ProjectReference[];
        if (references.length === 0) {
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("No references yet.", margin, y);
          doc.setTextColor(0);
        } else {
          for (const reference of references) {
            y = renderParagraph(doc, reference.citation, margin, y, { ...mdOpts, continuationIndent: 18 }) + 6;
          }
        }
      }

      if (includeSamples) {
        const { pageHeight, maxWidth } = startSection(doc, "portrait", margin);
        let y = margin + 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Samples", margin, y);
        doc.setFont("helvetica", "normal");
        y += 20;

        const captured = await captureSampleMap();
        if (captured) {
          const maxImgWidth = maxWidth;
          const maxImgHeight = pageHeight - y - margin - 140;
          const scale = Math.min(maxImgWidth / captured.width, maxImgHeight / captured.height, 1);
          const imgWidth = captured.width * scale;
          const imgHeight = captured.height * scale;
          doc.addImage(captured.dataUrl, "PNG", margin, y, imgWidth, imgHeight);
          y += imgHeight + 16;
          y = drawLegend(doc, captured.legend, captured.gbifLabels, margin, y) + 10;
        } else {
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("The map couldn't be captured.", margin, y);
          doc.setTextColor(0);
          y += 20;
        }

        const samplesData = await fetch("/api/samples").then((res) => res.json());
        const linkedIds = new Set(
          ((projectsData.links ?? []) as SampleProjectLink[])
            .filter((l) => l.project_id === projectId)
            .map((l) => l.sample_id)
        );
        const tableSamples = ((samplesData.samples ?? []) as SampleRecord[]).filter((s) => linkedIds.has(s.id));
        const columns = getVisibleColumns(DEFAULT_OPTIONAL_KEYS);
        const { head, body } = samplesToAutoTableRows(tableSamples, columns);
        autoTable(doc, {
          head,
          body,
          startY: y,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [42, 120, 214] },
        });
      }

      const workflowSections: { title: string; apiBase: string; choices: WorkflowChoice[] }[] = [
        { title: "Lab workflow", apiBase: "/api/lab-workflows", choices: labWorkflows },
        { title: "Bioinformatic workflow", apiBase: "/api/bio-workflows", choices: bioWorkflows },
      ];

      const allSamplesData = await fetch("/api/samples").then((res) => res.json());
      const allSamples = (allSamplesData.samples ?? []) as SampleRecord[];

      for (const section of workflowSections) {
        for (const choice of section.choices) {
          if (!choice.included) continue;
          const detail = await fetch(`${section.apiBase}/${choice.id}`).then((res) => res.json());
          if (detail.errors?.length > 0) continue;

          startSection(doc, choice.orientation, margin);
          let y = margin + 10;
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(`${section.title}: ${choice.name}`, margin, y);
          doc.setFont("helvetica", "normal");
          y += 24;

          const enrolledIds = new Set<string>(detail.sampleIds ?? []);
          const enrolledSamples = allSamples.filter((s) => enrolledIds.has(s.id));
          const columns = (detail.detailColumns ?? []) as LabWorkflowDetailColumn[];
          const rows = (detail.detailRows ?? []) as LabWorkflowDetailRow[];
          const values = (detail.detailValues ?? []) as LabWorkflowDetailValue[];
          const { head, body } = detailTableToAutoTableRows(enrolledSamples, rows, columns, values);

          if (body.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(140);
            doc.text("No samples enrolled.", margin, y);
            doc.setTextColor(0);
          } else {
            autoTable(doc, {
              head,
              body,
              startY: y,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8 },
              headStyles: { fillColor: [42, 120, 214] },
            });
          }
        }
      }

      const sampleById = new Map(allSamples.map((s) => [s.id, s]));

      const notesSections: { title: string; blocksEndpoint: string; imagesEndpoint: string; included: boolean }[] = [
        { title: "Lab notes", blocksEndpoint: "lab-notes-blocks", imagesEndpoint: "lab-note-images", included: includeLabNotes },
        { title: "Bioinformatic notes", blocksEndpoint: "bio-notes-blocks", imagesEndpoint: "bio-note-images", included: includeBioNotes },
      ];

      for (const section of notesSections) {
        if (!section.included) continue;
        const { pageHeight, maxWidth } = startSection(doc, "portrait", margin);
        const mdOpts = { x: margin, maxWidth, pageHeight, marginBottom: margin };
        let y = margin + 10;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, y);
        doc.setFont("helvetica", "normal");
        y += 24;

        const blocksData = await fetch(`/api/projects/${projectId}/${section.blocksEndpoint}`).then((res) =>
          res.json()
        );
        const blocks = (blocksData.blocks ?? []) as (LabNotesBlock | BioNotesBlock)[];
        if (blocks.length === 0) {
          doc.setFontSize(10);
          doc.setTextColor(140);
          doc.text("No entries yet.", margin, y);
          doc.setTextColor(0);
          y += 20;
        }
        for (const block of blocks) {
          if (y + 24 > pageHeight - margin) {
            doc.addPage("a4", "portrait");
            y = margin;
          }
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text(block.title, margin, y);
          doc.setFont("helvetica", "normal");
          y += 16;

          doc.setFontSize(9);
          doc.setTextColor(140);
          doc.text(formatTimestampDisplay(block.created_at), margin, y);
          doc.setTextColor(0);
          y += 16;

          y = renderMarkdownToPdf(doc, block.content || "*Empty block.*", y, mdOpts) + 20;
        }

        const imagesData = await fetch(`/api/projects/${projectId}/${section.imagesEndpoint}`).then((res) =>
          res.json()
        );
        const images = (imagesData.images ?? []) as NoteImage[];
        if (images.length > 0) {
          if (y + 30 > pageHeight - margin) {
            doc.addPage("a4", "portrait");
            y = margin;
          }
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("Images", margin, y);
          doc.setFont("helvetica", "normal");
          y += 20;

          for (const image of images) {
            const loaded = await loadImageAsDataUrl(image.image_url);
            const identifiers = image.sample_ids
              .map((id) => sampleById.get(id)?.primary_identifier)
              .filter((v): v is string => Boolean(v));
            // Cap by both width and available page height (not just width,
            // as the map capture does) — a note image's own aspect ratio
            // isn't controlled the way a rendered map is, so a tall photo
            // could otherwise overflow a fresh page.
            const maxImgWidth = Math.min(maxWidth, 260);
            const maxImgHeight = pageHeight - margin * 2 - 50;
            const scale = loaded ? Math.min(maxImgWidth / loaded.width, maxImgHeight / loaded.height, 1) : 0;
            const imgWidth = loaded ? loaded.width * scale : 0;
            const imgHeight = loaded ? loaded.height * scale : 0;

            if (y + 30 + imgHeight > pageHeight - margin) {
              doc.addPage("a4", "portrait");
              y = margin;
            }

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(image.title, margin, y);
            doc.setFont("helvetica", "normal");
            y += 14;

            doc.setFontSize(9);
            doc.setTextColor(140);
            doc.text(formatTimestampDisplay(image.created_at), margin, y);
            doc.setTextColor(0);
            y += 14;

            if (loaded) {
              doc.addImage(loaded.dataUrl, imageFormatFromDataUrl(loaded.dataUrl), margin, y, imgWidth, imgHeight);
              y += imgHeight + 8;
            } else {
              doc.setFontSize(9);
              doc.setTextColor(140);
              doc.text("(Image couldn't be embedded)", margin, y);
              doc.setTextColor(0);
              y += 14;
            }

            if (identifiers.length > 0) {
              doc.setFontSize(9);
              doc.setTextColor(90);
              doc.text(`Samples: ${identifiers.join(", ")}`, margin, y);
              doc.setTextColor(0);
              y += 14;
            }
            if (image.notes) {
              y = renderParagraph(doc, image.notes, margin, y, mdOpts) + 6;
            }
            y += 12;
          }
        }
      }

      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      doc.save(`specibase-${slug}-export.pdf`);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(`Couldn't compile the PDF: ${message}`);
    } finally {
      setCompiling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Export project PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export project PDF</DialogTitle>
          <DialogDescription>Choose which parts of the project to include.</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeInfo} onCheckedChange={() => setIncludeInfo((v) => !v)} />
            Info (Background, Notes, References)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeSamples} onCheckedChange={() => setIncludeSamples((v) => !v)} />
            Samples (map and table)
          </label>

          {loadingLists ? (
            <p className="text-sm text-muted-foreground">Loading workflows...</p>
          ) : (
            <>
              {labWorkflows.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Lab workflow</p>
                  {labWorkflows.map((choice) => (
                    <WorkflowChoiceRow
                      key={choice.id}
                      choice={choice}
                      onToggle={() => toggleWorkflow(labWorkflows, setLabWorkflows, choice.id)}
                      onSetOrientation={(o) => setWorkflowOrientation(labWorkflows, setLabWorkflows, choice.id, o)}
                    />
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeLabNotes} onCheckedChange={() => setIncludeLabNotes((v) => !v)} />
                Lab notes
              </label>
              {bioWorkflows.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Bioinformatic workflow</p>
                  {bioWorkflows.map((choice) => (
                    <WorkflowChoiceRow
                      key={choice.id}
                      choice={choice}
                      onToggle={() => toggleWorkflow(bioWorkflows, setBioWorkflows, choice.id)}
                      onSetOrientation={(o) => setWorkflowOrientation(bioWorkflows, setBioWorkflows, choice.id, o)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeBioNotes} onCheckedChange={() => setIncludeBioNotes((v) => !v)} />
            Bioinformatic notes
          </label>
        </div>

        <DialogFooter>
          <Button onClick={compile} disabled={compiling || loadingLists}>
            {compiling ? "Compiling..." : "Compile PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {mapExportProps && (
        <div style={{ position: "fixed", left: -10000, top: 0, width: 800, height: 500 }} aria-hidden>
          <SampleMap
            ref={mapHandleRef}
            samples={mapExportProps.samples}
            layers={[mapExportProps.layer]}
            visibleLayerIds={new Set([projectId])}
            popupColumns={[]}
            hiddenSampleIds={new Set()}
            highlightedSampleId={null}
            gbifLayers={[]}
            visibleGbifIds={new Set()}
          />
        </div>
      )}
    </Dialog>
  );
}
