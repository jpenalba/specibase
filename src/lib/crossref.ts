import { CitationMetadata } from "./citation-metadata";

const CROSSREF_API = "https://api.crossref.org/works";
// Crossref asks requests to self-identify (a descriptive User-Agent, ideally
// with a contact) for its "polite pool" — better rate limits and
// reliability. No registration or API key is required either way.
const USER_AGENT = "Specibase (https://github.com/jpenalba/specibase)";

type CrossrefDateParts = { "date-parts"?: number[][] };

type CrossrefItem = {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string }[];
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  published?: CrossrefDateParts;
  "published-print"?: CrossrefDateParts;
  "published-online"?: CrossrefDateParts;
};

function extractYear(item: CrossrefItem): number | null {
  const parts =
    item.published?.["date-parts"]?.[0] ??
    item["published-print"]?.["date-parts"]?.[0] ??
    item["published-online"]?.["date-parts"]?.[0];
  return parts?.[0] ?? null;
}

function toMetadata(item: CrossrefItem): CitationMetadata | null {
  const title = item.title?.[0]?.trim();
  if (!title || !item.DOI) return null;
  return {
    doi: item.DOI,
    title,
    authors: (item.author ?? [])
      .filter((a): a is { given?: string; family: string } => Boolean(a.family))
      .map((a) => ({ given: a.given, family: a.family })),
    year: extractYear(item),
    journal: item["container-title"]?.[0] ?? null,
    volume: item.volume ?? null,
    issue: item.issue ?? null,
    pages: item.page ?? null,
  };
}

// Free, keyless title search — used by the References section to find a
// paper's structured metadata for APA formatting, without asking anyone
// to hand-type author/year/journal fields themselves. Crossref's own
// relevance ranking decides order; this just maps its shape into ours and
// drops any item missing the two things a citation can't do without
// (title, DOI).
export async function searchCrossref(title: string, limit = 5): Promise<CitationMetadata[]> {
  const url = `${CROSSREF_API}?query.bibliographic=${encodeURIComponent(title)}&rows=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Crossref search failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const items: CrossrefItem[] = data?.message?.items ?? [];
  return items.map(toMetadata).filter((m): m is CitationMetadata => m !== null);
}
