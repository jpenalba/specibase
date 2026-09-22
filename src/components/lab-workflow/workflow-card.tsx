import Link from "next/link";
import { Pencil, ListChecks } from "lucide-react";
import { LabWorkflow } from "@/lib/lab-workflows-store";
import { WorkflowStatusBadge } from "./workflow-status-badge";
import { WorkflowDialog } from "./workflow-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WorkflowCard({
  projectId,
  workflow,
  onSaved,
}: {
  projectId: string;
  workflow: LabWorkflow;
  onSaved: (workflow: LabWorkflow) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{workflow.name}</h3>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
        </div>
        <WorkflowDialog
          projectId={projectId}
          workflow={workflow}
          onSaved={onSaved}
          trigger={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Edit ${workflow.name}`}
            >
              <Pencil className="size-4" />
            </button>
          }
        />
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={`/lab-workflow/${projectId}/${workflow.id}`}>
            <ListChecks className="size-4" />
            Open grid
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
