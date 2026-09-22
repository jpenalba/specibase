import Link from "next/link";
import { Workflow } from "lucide-react";
import { Project } from "@/lib/projects-store";
import { FocalGroupIcon } from "@/components/projects/focal-group-icon";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

// The Lab Workflow tab's entry point: the same projects, but the card
// links into that project's workflows instead of its sample list or an
// edit dialog — editing a project's own details stays on the Projects tab.
export function ProjectWorkflowCard({
  project,
  workflowCount,
}: {
  project: Project;
  workflowCount: number;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <FocalGroupIcon focalGroup={project.focal_group} logo={project.logo} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{project.name}</h3>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {workflowCount} workflow{workflowCount === 1 ? "" : "s"}
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/lab-workflow/${project.id}`}>
            <Workflow className="size-4" />
            Open workflows
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
