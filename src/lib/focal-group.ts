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
  | "ant"
  | "bee"
  | "wasp"
  | "spider"
  | "crab"
  | "plant"
  | "other";

// All pickable categories, in the order the logo picker shows them —
// each specific category follows the broader group it was split out of
// (snake out of reptile; beetle/butterfly/moth/ant/bee/wasp out of
// insect), "other" last since it's the generic catch-all. spider and crab
// aren't insects (arachnid, crustacean) so they aren't split out of
// anything — they just sit alongside the other arthropods.
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
  "ant",
  "bee",
  "wasp",
  "spider",
  "crab",
  "plant",
  "other",
];

// Keyword -> category, checked as a substring against the lowercased
// "Focal species/group" text. First match wins; a specific category
// (snake, beetle, butterfly, moth, ant, bee, wasp) is listed before the
// broader one it was split out of (reptile, insect respectively) so its
// own keyword isn't shadowed.
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
  ["insect", ["insect", "drosophila", "fly", "cricket", "grasshopper", "dragonfly"]],
  ["spider", ["spider", "arachnid", "tarantula"]],
  ["crab", ["crab", "crustacean"]],
  ["plant", ["plant", "flora", "tree", "orchid", "flower", "angiosperm", "grass", "fern", "moss", "conifer"]],
];

// Short keywords ("ant", "bee", "cat", "ray"...) are prone to false
// substring hits inside unrelated words — "ant" alone would otherwise
// match "tarantula", "cat" would match "indicate", "ray" would match
// "array". Requiring a word boundary around anything 4 letters or
// shorter avoids that, while longer keywords keep plain substring
// matching so a compound name without a space (e.g. "dragonfly") still
// matches via its own explicit keyword.
function matchesKeyword(text: string, keyword: string): boolean {
  if (keyword.length <= 4) {
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
