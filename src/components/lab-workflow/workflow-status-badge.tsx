import { WorkflowStatus } from "@/lib/lab-workflows-store";
import { cn } from "@/lib/utils";

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const isInProgress = status === "in_progress";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        isInProgress
          ? "bg-success text-success-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {isInProgress ? "In progress" : "Completed"}
    </span>
  );
}
