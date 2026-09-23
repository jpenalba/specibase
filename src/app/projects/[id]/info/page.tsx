"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Project } from "@/lib/projects-store";
import { ProjectReference } from "@/lib/project-references-store";
import { parseCollaborators } from "@/lib/collaborators";
import { formatToDDMMYYYY } from "@/lib/dates";
import { renderMarkdownToPdf, renderParagraph } from "@/lib/markdown-pdf";
import { MarkdownField } from "@/components/projects/markdown-field";
import { ReferencesSection } from "@/components/projects/references-section";
import { Button } from "@/components/ui/button";

function DetailField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold">{children}</h2>;
}

export default function ProjectInfoPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  // Loaded independently of ReferencesSection's own internal state — this
  // page only needs the list for the PDF export below, not for rendering
  // (ReferencesSection handles that itself).
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch(`/api/projects/${projectId}/references`).then((res) => res.json()),
    ])
      .then(([data, referencesData]) => {
        if (cancelled) return;
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setProject((data.projects ?? []).find((p: Project) => p.id === projectId) ?? null);
        setReferences(referencesData.references ?? []);
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
  }, [projectId]);

  async function exportPdf() {
    if (!project) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const margin = 40;
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
      const mdOpts = { x: margin, maxWidth, pageHeight, marginBottom: margin };

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(project.name, margin, margin);
      doc.setFont("helvetica", "normal");
      let y = margin + 30;

      function heading(title: string) {
        if (y + 24 > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, y);
        doc.setFont("helvetica", "normal");
        y += 22;
      }

      function emptyNote(text: string) {
        doc.setFontSize(10);
        doc.setTextColor(140);
        doc.text(text, margin, y);
        doc.setTextColor(0);
        y += 20;
      }

      heading("Background");
      if (project.background) {
        y = renderMarkdownToPdf(doc, project.background, y, mdOpts) + 14;
      } else {
        emptyNote("Nothing written yet.");
      }

      heading("Notes");
      if (project.notes) {
        y = renderMarkdownToPdf(doc, project.notes, y, mdOpts) + 14;
      } else {
        emptyNote("Nothing written yet.");
      }

      heading("References");
      if (references.length === 0) {
        emptyNote("No references yet.");
      } else {
        for (const reference of references) {
          y = renderParagraph(doc, reference.citation, margin, y, { ...mdOpts, continuationIndent: 18 }) + 6;
        }
      }

      const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      doc.save(`specibase-${slug}-info.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading...</p>;
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Project not found."}
      </div>
    );
  }

  const collaborators = parseCollaborators(project.collaborators);
  const hasDetails =
    project.start_date || project.owner || project.focal_group || project.focal_region || collaborators.length > 0;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={exporting}>
          {exporting ? "Exporting..." : "Export PDF"}
        </Button>
      </div>

      <section>
        <SectionHeading>Details</SectionHeading>
        {hasDetails ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <DetailField
              label="Start date"
              value={project.start_date ? formatToDDMMYYYY(project.start_date) : null}
            />
            <DetailField label="Owner" value={project.owner} />
            <DetailField label="Focal species/group" value={project.focal_group} />
            <DetailField label="Focal region" value={project.focal_region} />
            {collaborators.length > 0 && (
              <div className="col-span-full">
                <dt className="text-xs font-medium text-muted-foreground">Collaborators</dt>
                <dd className="flex flex-wrap gap-1 pt-1">
                  {collaborators.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                    >
                      {name}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No additional details yet — add them by editing the project from the Projects tab.
          </p>
        )}
      </section>

      <section>
        <SectionHeading>Background</SectionHeading>
        <MarkdownField
          projectId={projectId}
          fieldKey="background"
          label="Background"
          value={project.background}
          onSaved={setProject}
        />
      </section>

      <section>
        <SectionHeading>Notes</SectionHeading>
        <MarkdownField
          projectId={projectId}
          fieldKey="notes"
          label="Notes"
          value={project.notes}
          onSaved={setProject}
        />
      </section>

      <section>
        <SectionHeading>References</SectionHeading>
        <ReferencesSection projectId={projectId} />
      </section>
    </div>
  );
}
