import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// A profile photo if one's set, otherwise a grey head-and-torso
// placeholder — used next to the account dropdown trigger and inside the
// Profile dialog's own (larger) preview.
export function Avatar({
  url,
  size = 28,
  className,
}: {
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small avatar isn't worth next/image's config
      <img
        src={url}
        alt=""
        style={style}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className
      )}
    >
      <UserRound className="size-[65%]" />
    </span>
  );
}
