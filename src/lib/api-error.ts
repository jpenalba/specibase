import { NextResponse } from "next/server";

// An uncaught throw from a route handler (missing table, bad Supabase
// creds, etc.) isn't guaranteed to come back as valid JSON, which breaks
// any client doing `await res.json()` — including one fetch failure
// silently preventing an unrelated fetch's result from ever being used.
// Routes catch their own errors and return this instead.
export function apiError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ errors: [message] }, { status });
}
