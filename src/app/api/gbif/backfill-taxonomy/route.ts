import { NextResponse } from "next/server";
import { backfillSpeciesTaxonomy } from "@/lib/gbif-backfill";
import { apiError } from "@/lib/api-error";

// One-time, manually-triggered pass (see the Database page's button) —
// no cron/queue in this app, so a person clicks it once after the
// migration adding genus/family/taxon_order/taxon_class has been run.
export async function POST() {
  try {
    const result = await backfillSpeciesTaxonomy();
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
