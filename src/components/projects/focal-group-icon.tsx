import { categorizeFocalGroup, FOCAL_GROUP_CATEGORIES, FocalGroupCategory } from "@/lib/focal-group";

// Maps a category to its icon file under public/logos. Categories without
// a matching icon yet (insect, other) fall back to the generic tube
// icon — more of these will be added as icons for them come in, at which
// point they just get their own entry here.
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

// The logo picker (project-dialog.tsx) shows one button per entry here
// rather than per FOCAL_GROUP_CATEGORIES entry — every category without
// its own icon yet falls back to the same generic tube image, and "other"
// is the one that gets to keep a button for it; any other such category
// (currently just "insect") would just be an identical-looking duplicate.
// Still fully valid categorization targets via categorizeFocalGroup, just
// not separately pickable until they get their own icon.
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
