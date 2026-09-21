import { ProjectStatus } from "@/lib/projects-store";
import { cn } from "@/lib/utils";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
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
