import { categorizeFocalGroup, FOCAL_GROUP_CATEGORIES, FocalGroupCategory } from "@/lib/focal-group";

// Maps a category to its icon file under public/logos. Every category has
// its own entry here now except "other" (the generic catch-all), which
// falls back to the tube icon below.
const CATEGORY_IMAGE: Partial<Record<FocalGroupCategory, string>> = {
  bird: "/logos/bird.png",
  mammal: "/logos/mouse.png",
  fish: "/logos/fish.png",
  reptile: "/logos/lizard.png",
  snake: "/logos/snake.png",
  amphibian: "/logos/frog.png",
  beetle: "/logos/beetle.png",
  butterfly: "/logos/butterfly.png",
  moth: "/logos/moth.png",
  ant: "/logos/ant.png",
  bee: "/logos/bee.png",
  wasp: "/logos/wasp.png",
  spider: "/logos/spider.png",
  crab: "/logos/crab.png",
  shrimp: "/logos/shrimp.png",
  snail: "/logos/snail.png",
  coral: "/logos/coral.png",
  fungus: "/logos/fungus.png",
  plant: "/logos/plant.png",
  bacteria: "/logos/bacteria.png",
};
const DEFAULT_IMAGE = "/logos/tube.png";

// The logo picker (project-dialog.tsx) shows one button per entry here.
// With every real category now having its own icon, this just filters out
// any future category added without one yet (so it doesn't show up as a
// duplicate-looking tube button until it gets its own art) — "other"
// always keeps its button as the one legitimate user of the tube fallback.
export const PICKABLE_LOGO_CATEGORIES: FocalGroupCategory[] = FOCAL_GROUP_CATEGORIES.filter(
  (category) => category === "other" || category in CATEGORY_IMAGE
);

export function FocalGroupIcon({
  focalGroup,
  logo,
  size = 40,
}: {
  focalGroup: string | null | undefined;
  // An explicit category choice — wins over auto-matching focalGroup's
  // text when set. Pass undefined/null to always auto-match.
  logo?: FocalGroupCategory | null;
  size?: number;
}) {
  const category = logo ?? categorizeFocalGroup(focalGroup);
  const src = CATEGORY_IMAGE[category] ?? DEFAULT_IMAGE;
  return (
    // A small, static per-category icon isn't worth next/image's overhead.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${category} icon`}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      style={{ width: size, height: size }}
    />
  );
}
