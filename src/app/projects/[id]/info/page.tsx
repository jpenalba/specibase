"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Project } from "@/lib/projects-store";
import { parseCollaborators } from "@/lib/collaborators";
import { formatToDDMMYYYY } from "@/lib/dates";
import { MarkdownField } from "@/components/projects/markdown-field";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setProject((data.projects ?? []).find((p: Project) => p.id === projectId) ?? null);
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
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          References — coming soon.
        </div>
      </section>
    </div>
  );
}
