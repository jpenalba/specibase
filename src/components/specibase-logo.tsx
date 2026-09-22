import { Database, TestTube } from "lucide-react";
import { cn } from "@/lib/utils";

// Composed from two existing lucide icons (a database + a test tube
// overlapping its bottom-right corner) rather than a new hand-drawn SVG —
// same simple grey line-art style already used everywhere else in the
// app, and stroke="currentColor" (lucide's default) means it follows the
// surrounding text color for free, light or dark theme alike.
export function SpecibaseLogo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Database className="size-full" strokeWidth={2} />
      <TestTube
        className="absolute -right-px -bottom-px rounded-full bg-background"
        style={{ width: size * 0.52, height: size * 0.52 }}
        strokeWidth={2.5}
      />
    </span>
  );
}
