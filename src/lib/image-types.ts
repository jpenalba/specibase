// Shared between the server-only upload store (project-images-store.ts)
// and client-side upload UI — kept dependency-free so it's safe to import
// from a client component, unlike project-images-store.ts itself (which
// pulls in the server-only Supabase client and Node's crypto module).
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
