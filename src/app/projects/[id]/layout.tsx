"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Project } from "@/lib/projects-store";
import { FocalGroupIcon } from "@/components/projects/focal-group-icon";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectExportDialog } from "@/components/projects/project-export-dialog";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "info", label: "Info" },
  { slug: "samples", label: "Samples" },
  { slug: "lab-workflow", label: "Lab workflow" },
  { slug: "bioinformatics", label: "Bioinformatic workflow" },
  { slug: "bio-notes", label: "Bioinformatic notes" },
];

// The project's home shell: shared across every tab (Info, Samples, Lab
// workflow, Bioinformatic workflow, Bioinformatic notes), each its own
// route under here — so a tab is bookmarkable/shareable and the project's
// identity (icon, name, status, description) only needs fetching and
// rendering once.
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id: projectId } = useParams<{ id: string }>();
  const pathname = usePathname();

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

  if (!loading && (error || !project)) {
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
    <div className="flex flex-col gap-6 p-6 sm:p-10">
      {/* Header and tabs stay at reading width; a tab's own content (e.g.
          the Lab workflow grid) can opt into a wider container below,
          since it isn't nested inside this max-w-6xl wrapper. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to projects
        </Link>

        {project && (
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
            <ProjectExportDialog projectId={projectId} />
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => {
            const href = `/projects/${projectId}/${tab.slug}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={tab.slug}
                href={href}
                className={cn(
                  "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
