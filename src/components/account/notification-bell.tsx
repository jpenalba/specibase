"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  collection_id: string | null;
  collection_name: string | null;
  actor_name: string | null;
};

const POLL_INTERVAL_MS = 60_000;

// The nav bar's bell — "X shared a project/collection with you" (see
// notifications-store.ts), built as a list since nothing stops several
// people sharing something with the same account before they're next
// online to see any of them. Polls rather than pushing: this app has no
// realtime channel set up, and a once-a-minute lag before a brand-new
// share shows up here is an acceptable tradeoff against standing one up
// just for this.
export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {
        // Silent — a missed poll just tries again next interval.
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  function handleOpen(notification: Notification) {
    // Optimistic — clears it immediately rather than waiting on the
    // dismiss call, which is fire-and-forget here the same way
    // markNotificationSeen's other callers in this app treat it.
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    fetch(`/api/notifications/${notification.id}/seen`, { method: "POST" }).catch(() => {});
    if (notification.project_id) {
      router.push(`/projects/${notification.project_id}`);
    } else if (notification.collection_id) {
      router.push(`/collections/${notification.collection_id}/samples`);
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-md p-1.5 text-muted-foreground opacity-50" aria-hidden="true">
        <Bell className="size-5" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={`${notifications.length} new notification${notifications.length === 1 ? "" : "s"}`}
        >
          <Bell className="size-5" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {notifications.length}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {notifications.map((notification) => {
          const itemName = notification.project_id
            ? notification.project_name ?? "a project"
            : notification.collection_name ?? "a collection";
          return (
            <DropdownMenuItem key={notification.id} onSelect={() => handleOpen(notification)}>
              <span className="text-sm">
                <strong>{notification.actor_name ?? "Someone"}</strong> shared{" "}
                <strong>{itemName}</strong> with you
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
