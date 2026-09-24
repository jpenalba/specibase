export type FocalGroupCategory =
  | "bird"
  | "mammal"
  | "fish"
  | "reptile"
  | "snake"
  | "amphibian"
  | "beetle"
  | "butterfly"
  | "moth"
  | "ant"
  | "bee"
  | "wasp"
  | "spider"
  | "crab"
  | "shrimp"
  | "snail"
  | "coral"
  | "fungus"
  | "plant"
  | "bacteria"
  | "other";

// All pickable categories, in the order the logo picker shows them, each
// one with its own icon — "other" last since it's the sole exception: the
// generic catch-all, sharing the tube icon with nothing else now that
// every real category has its own. There's no generic "insect" bucket —
// beetle/butterfly/moth/ant/bee/wasp cover the specific ones with icons,
// and anything else insect-y just falls through to "other".
export const FOCAL_GROUP_CATEGORIES: FocalGroupCategory[] = [
  "bird",
  "mammal",
  "fish",
  "reptile",
  "snake",
  "amphibian",
  "beetle",
  "butterfly",
  "moth",
  "ant",
  "bee",
  "wasp",
  "spider",
  "crab",
  "shrimp",
  "snail",
  "coral",
  "fungus",
  "plant",
  "bacteria",
  "other",
];

// Keyword -> category, checked as a substring against the lowercased
// "Focal species/group" text. First match wins; "snake" is listed before
// "reptile" so a snake keyword isn't shadowed by the broader reptile one.
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
  ["ant", ["ant", "formicidae"]],
  ["bee", ["bee", "apidae", "honeybee", "bumblebee"]],
  ["wasp", ["wasp", "hornet", "yellowjacket"]],
  ["spider", ["spider", "arachnid", "tarantula"]],
  ["crab", ["crab", "crustacean"]],
  ["shrimp", ["shrimp", "prawn"]],
  ["snail", ["snail", "gastropod", "slug"]],
  ["coral", ["coral", "anemone", "cnidarian"]],
  ["fungus", ["fungus", "fungi", "mushroom", "mycelium", "lichen"]],
  ["plant", ["plant", "flora", "tree", "orchid", "flower", "angiosperm", "grass", "fern", "moss", "conifer"]],
  ["bacteria", ["bacteria", "bacterium", "microbe", "prokaryote", "microbiome"]],
];

// Short keywords ("ant", "bee", "cat", "ray"...) are prone to false
// substring hits inside unrelated words — "ant" alone would otherwise
// match "tarantula", "cat" would match "indicate", "ray" would match
// "array". Requiring a word boundary around anything 4 letters or
// shorter avoids that, while longer keywords keep plain substring
// matching so a compound scientific name without a space (e.g. a family
// name like "viperidae") still matches via its base keyword ("viper").
//
// A few longer keywords have the same false-hit problem despite their
// length — "grass" would otherwise match inside "grasshopper" — and need
// a boundary too even though they're over 4 letters.
const BOUNDARY_REQUIRED_KEYWORDS = new Set(["grass"]);

function matchesKeyword(text: string, keyword: string): boolean {
  if (keyword.length <= 4 || BOUNDARY_REQUIRED_KEYWORDS.has(keyword)) {
    return new RegExp(`\\b${keyword}\\b`).test(text);
  }
  return text.includes(keyword);
}

export function categorizeFocalGroup(focalGroup: string | null | undefined): FocalGroupCategory {
  if (!focalGroup) return "other";
  const lower = focalGroup.toLowerCase();
  for (const [category, keywords] of KEYWORDS) {
    if (keywords.some((keyword) => matchesKeyword(lower, keyword))) return category;
  }
  return "other";
}
