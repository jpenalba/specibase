import { categorizeFocalGroup, FocalGroupCategory } from "@/lib/focal-group";

// One fixed background color per category — not the layer-color palette
// (@/lib/layer-colors), which is for map data layers and gets reassigned
// per project; this is a fixed "what kind of organism" indicator instead.
const CATEGORY_COLOR: Record<FocalGroupCategory, string> = {
  bird: "#3b82f6",
  mammal: "#92400e",
  fish: "#0d9488",
  reptile: "#15803d",
  amphibian: "#65a30d",
  insect: "#ea580c",
  plant: "#059669",
  other: "#64748b",
};

// Minimal single-color glyphs, each drawn in a 24x24 box — plain
// geometric shapes rather than an attempt at a realistic silhouette,
// which is both more in keeping with "minimal" and easier to keep
// legible at the small size this renders at.
function Glyph({ category }: { category: FocalGroupCategory }) {
  const stroke = "#ffffff";
  switch (category) {
    case "bird":
      return (
        <path
          d="M3 15 Q7.5 8 12 15 Q16.5 8 21 15"
          fill="none"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "mammal":
      return (
        <g fill={stroke}>
          <ellipse cx={12} cy={16.5} rx={5} ry={4} />
          <circle cx={6} cy={9} r={2} />
          <circle cx={10.3} cy={5.8} r={2.2} />
          <circle cx={13.7} cy={5.8} r={2.2} />
          <circle cx={18} cy={9} r={2} />
        </g>
      );
    case "fish":
      return (
        <g fill={stroke}>
          <ellipse cx={9.5} cy={12} rx={6.5} ry={4.3} />
          <polygon points="16,12 22,7.5 22,16.5" />
          <circle cx={6.5} cy={11} r={0.9} fill="#0d9488" />
        </g>
      );
    case "reptile":
      return (
        <g stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none">
          <path d="M16 15 Q21 15 21 20" />
          <ellipse cx={11.5} cy={15} rx={5.5} ry={3.2} fill={stroke} stroke="none" />
          <polygon points="4,15 8,12 8,18" fill={stroke} stroke="none" />
          <line x1={8.5} y1={12} x2={7} y2={8} />
          <line x1={8.5} y1={18} x2={7} y2={22} />
          <line x1={14.5} y1={12} x2={16} y2={8} />
          <line x1={14.5} y1={18} x2={16} y2={22} />
        </g>
      );
    case "amphibian":
      return (
        <g fill={stroke}>
          <ellipse cx={12} cy={15} rx={7} ry={5} />
          <circle cx={7.5} cy={7.5} r={2.2} />
          <circle cx={16.5} cy={7.5} r={2.2} />
          <circle cx={7.5} cy={7.5} r={0.8} fill="#65a30d" />
          <circle cx={16.5} cy={7.5} r={0.8} fill="#65a30d" />
        </g>
      );
    case "insect":
      return (
        <g strokeLinecap="round">
          <circle cx={12} cy={14} r={7} fill={stroke} />
          <circle cx={12} cy={5.3} r={2.3} fill={stroke} />
          <line x1={10.8} y1={3.3} x2={8.5} y2={1} stroke={stroke} strokeWidth={1.3} />
          <line x1={13.2} y1={3.3} x2={15.5} y2={1} stroke={stroke} strokeWidth={1.3} />
          <line x1={12} y1={7.3} x2={12} y2={20.5} stroke="#ea580c" strokeWidth={1.3} />
          <circle cx={9} cy={11.5} r={1.1} fill="#ea580c" />
          <circle cx={15} cy={11.5} r={1.1} fill="#ea580c" />
          <circle cx={9} cy={17} r={1.1} fill="#ea580c" />
          <circle cx={15} cy={17} r={1.1} fill="#ea580c" />
        </g>
      );
    case "plant":
      return (
        <g fill={stroke}>
          <path d="M12 21 C4 17 4 9 12 3 C20 9 20 17 12 21 Z" />
          <rect x={11.4} y={5} width={1.2} height={16} fill="#059669" />
        </g>
      );
    case "other":
    default:
      return (
        <g fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round">
          <circle cx={10} cy={10} r={6} />
          <line x1={14.3} y1={14.3} x2={20} y2={20} />
        </g>
      );
  }
}

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
  const color = CATEGORY_COLOR[category];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={`${category} icon`}>
      <circle cx={12} cy={12} r={12} fill={color} />
      <Glyph category={category} />
    </svg>
  );
}
