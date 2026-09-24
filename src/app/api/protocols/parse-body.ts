import { PROTOCOL_TYPES, ProtocolType, ProtocolSourceType } from "@/lib/protocol-types";

// Distinguishes "this key wasn't in the request at all" (undefined — skip
// it on an update) from "it was sent as an empty string" (still undefined
// after trimming, but createProtocol/updateProtocol turn that into null,
// clearing the field) — mirrors @/app/api/collections/parse-body.ts.
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

export type ParsedProtocolFields = {
  description?: string;
  date_added?: string;
  protocol_type?: ProtocolType;
  source_type?: ProtocolSourceType;
  pdf_url?: string;
  pdf_filename?: string;
  content?: string;
};

// Shared between POST (create) and PATCH (update) — pulls the protocol
// detail fields out of a request body. protocol_type and source_type are
// validated (rather than trusted like the free-text fields) since they're
// both closed vocabularies the UI depends on.
export function parseProtocolFields(
  body: Record<string, unknown>
): ParsedProtocolFields | { error: string } {
  let protocolType: ProtocolType | undefined;
  if ("protocol_type" in body) {
    if (
      typeof body.protocol_type === "string" &&
      PROTOCOL_TYPES.includes(body.protocol_type as ProtocolType)
    ) {
      protocolType = body.protocol_type as ProtocolType;
    } else {
      return { error: `Unknown protocol type "${body.protocol_type}"` };
    }
  }

  let sourceType: ProtocolSourceType | undefined;
  if ("source_type" in body) {
    if (body.source_type === "pdf" || body.source_type === "built") {
      sourceType = body.source_type;
    } else {
      return { error: `Unknown protocol source "${body.source_type}"` };
    }
  }

  return {
    description: stringField(body, "description"),
    date_added: stringField(body, "date_added"),
    protocol_type: protocolType,
    source_type: sourceType,
    pdf_url: stringField(body, "pdf_url"),
    pdf_filename: stringField(body, "pdf_filename"),
    content: stringField(body, "content"),
  };
}
