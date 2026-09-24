import { categorizeFocalGroup, FocalGroupCategory } from "@/lib/focal-group";

// Maps a category to its icon file under public/logos. Categories without
// a matching icon yet (fish, insect, plant, other) fall back to the
// generic tube icon — more of these will be added as icons for them come
// in, at which point they just get their own entry here.
const CATEGORY_IMAGE: Partial<Record<FocalGroupCategory, string>> = {
  bird: "/logos/bird.png",
  mammal: "/logos/mouse.png",
  reptile: "/logos/lizard.png",
  amphibian: "/logos/frog.png",
};
const DEFAULT_IMAGE = "/logos/tube.png";

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
