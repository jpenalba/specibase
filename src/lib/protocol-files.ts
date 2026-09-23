// Shared between the server-only upload store (protocols-store.ts) and
// client-side upload UI — kept dependency-free so it's safe to import from
// a client component, unlike protocols-store.ts itself (which pulls in the
// server-only Supabase client and Node's crypto module).
export const ALLOWED_PROTOCOL_FILE_TYPES = ["application/pdf"];
export const MAX_PROTOCOL_PDF_BYTES = 25 * 1024 * 1024;
