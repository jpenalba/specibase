export type FocalGroupCategory =
  | "bird"
  | "mammal"
  | "fish"
  | "reptile"
  | "snake"
  | "amphibian"
  | "insect"
  | "beetle"
  | "butterfly"
  | "moth"
  | "plant"
  | "other";

// All pickable categories, in the order the logo picker shows them —
// each specific category follows the broader group it was split out of
// (snake out of reptile; beetle/butterfly/moth out of insect), "other"
// last since it's the generic catch-all.
export const FOCAL_GROUP_CATEGORIES: FocalGroupCategory[] = [
  "bird",
  "mammal",
  "fish",
  "reptile",
  "snake",
  "amphibian",
  "insect",
  "beetle",
  "butterfly",
  "moth",
  "plant",
  "other",
];

// Keyword -> category, checked as a substring against the lowercased
// "Focal species/group" text. First match wins; a specific category
// (snake, beetle, butterfly, moth) is listed before the broader one it
// was split out of (reptile, insect respectively) so its own keyword
// isn't shadowed.
const KEYWORDS: [FocalGroupCategory, string[]][] = [
  ["bird", ["bird", "aves", "songbird", "passerine", "warbler", "finch", "wren", "waterfowl", "raptor", "owl", "fairywren"]],
  ["mammal", ["mammal", "rodent", "primate", "bat", "carnivore", "ungulate", "marsupial", "rat", "mouse", "vole", "bear", "cat", "dog", "whale", "dolphin"]],
  ["fish", ["fish", "teleost", "cichlid", "shark", "ray", "salmon", "trout", "goby"]],
  ["snake", ["snake", "serpent", "viper", "python", "cobra", "boa"]],
  ["reptile", ["reptile", "lizard", "anole", "gecko", "turtle", "tortoise", "crocodile", "skink", "iguana"]],
  ["amphibian", ["amphibian", "frog", "toad", "salamander", "newt", "caecilian"]],
  ["beetle", ["beetle", "weevil"]],
  ["butterfly", ["butterfly", "lepidoptera"]],
  ["moth", ["moth"]],
  ["insect", ["insect", "ant", "bee", "wasp", "drosophila", "fly", "cricket", "grasshopper", "dragonfly"]],
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
