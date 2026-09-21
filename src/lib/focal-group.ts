export type FocalGroupCategory =
  | "bird"
  | "mammal"
  | "fish"
  | "reptile"
  | "amphibian"
  | "insect"
  | "plant"
  | "other";

// All pickable categories, in the order the logo picker shows them —
// "other" last since it's the generic catch-all.
export const FOCAL_GROUP_CATEGORIES: FocalGroupCategory[] = [
  "bird",
  "mammal",
  "fish",
  "reptile",
  "amphibian",
  "insect",
  "plant",
  "other",
];

// Keyword -> category, checked as a substring against the lowercased
// "Focal species/group" text. First match wins; order matters where a
// word could plausibly appear under more than one category.
const KEYWORDS: [FocalGroupCategory, string[]][] = [
  ["bird", ["bird", "aves", "songbird", "passerine", "warbler", "finch", "wren", "waterfowl", "raptor", "owl", "fairywren"]],
  ["mammal", ["mammal", "rodent", "primate", "bat", "carnivore", "ungulate", "marsupial", "rat", "mouse", "vole", "bear", "cat", "dog", "whale", "dolphin"]],
  ["fish", ["fish", "teleost", "cichlid", "shark", "ray", "salmon", "trout", "goby"]],
  ["reptile", ["reptile", "lizard", "anole", "gecko", "snake", "turtle", "tortoise", "crocodile", "skink", "iguana"]],
  ["amphibian", ["amphibian", "frog", "toad", "salamander", "newt", "caecilian"]],
  ["insect", ["insect", "beetle", "butterfly", "moth", "ant", "bee", "wasp", "drosophila", "fly", "cricket", "grasshopper", "dragonfly"]],
  ["plant", ["plant", "flora", "tree", "orchid", "flower", "angiosperm", "grass", "fern", "moss", "conifer"]],
];

export function categorizeFocalGroup(focalGroup: string | null | undefined): FocalGroupCategory {
  if (!focalGroup) return "other";
  const lower = focalGroup.toLowerCase();
  for (const [category, keywords] of KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return "other";
}
