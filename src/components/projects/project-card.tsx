import Link from "next/link";
import { Pencil, FolderOpen } from "lucide-react";
import { Project } from "@/lib/projects-store";
import { parseCollaborators } from "@/lib/collaborators";
import { formatToDDMMYYYY } from "@/lib/dates";
import { FocalGroupIcon } from "./focal-group-icon";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectDialog } from "./project-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function ProjectCard({
  project,
  sampleIds,
  onSaved,
}: {
  project: Project;
  sampleIds: string[];
  onSaved: () => void;
}) {
  const collaborators = parseCollaborators(project.collaborators);
  return (
    <Card className="relative">
      <div className="absolute left-3 top-3">
        <ProjectStatusBadge status={project.status} />
      </div>
      <CardHeader className="flex-row items-start gap-3 space-y-0 pt-10">
        {/* 1.8x the component's own default (40px) — the project list is
            the one place this icon is the card's primary visual anchor. */}
        <FocalGroupIcon focalGroup={project.focal_group} logo={project.logo} size={72} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <ProjectDialog
          project={project}
          onSaved={onSaved}
          trigger={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Edit ${project.name}`}
            >
              <Pencil className="size-4" />
            </button>
          }
        />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field
            label="Start date"
            value={project.start_date ? formatToDDMMYYYY(project.start_date) : null}
          />
          <Field label="Owner" value={project.owner} />
          <Field label="Focal species/group" value={project.focal_group} />
          <Field label="Focal region" value={project.focal_region} />
          {collaborators.length > 0 && (
            <div className="col-span-2">
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
      </CardContent>
      <CardFooter className="justify-between">
        <p className="text-xs text-muted-foreground">
          {sampleIds.length} sample{sampleIds.length === 1 ? "" : "s"}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}`}>
            <FolderOpen className="size-4" />
            Open project
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
