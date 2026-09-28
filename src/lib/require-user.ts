import { NextResponse } from "next/server";
import { getCurrentUser, CurrentUser } from "./current-user";

// The DAL-level check the auth plan calls for — every route that reads or
// writes owner-scoped data (samples, collections, protocols, sample
// custom columns) calls this first. `"response" in result` means bail out
// and return it as-is; otherwise `result.user` is who's asking.
export async function requireUser(): Promise<
  { user: CurrentUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ errors: ["Not authenticated"] }, { status: 401 }) };
  }
  return { user };
}
