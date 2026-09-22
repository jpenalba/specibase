// Shared, dependency-free shape used both by the Crossref search results
// (rendered client-side for someone to pick from) and by the APA
// formatter (src/lib/apa-format.ts) that turns a picked result into a
// stored citation string.
export type CitationAuthor = { given?: string; family: string };

export type CitationMetadata = {
  doi: string;
  title: string;
  authors: CitationAuthor[];
  year: number | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
};
