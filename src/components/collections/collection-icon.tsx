// Always the same grey circle with three partially superimposed squares —
// unlike a project's FocalGroupIcon, a collection has no per-item icon
// choice or auto-matched category.
const CIRCLE_COLOR = "#6b7280";
const SQUARE_COLOR = "#ffffff";

export function CollectionIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Collection icon">
      <circle cx={12} cy={12} r={12} fill={CIRCLE_COLOR} />
      <g fill={SQUARE_COLOR} stroke={CIRCLE_COLOR} strokeWidth={1} strokeLinejoin="round">
        <rect x={4.5} y={4.5} width={8} height={8} rx={1.3} />
        <rect x={8} y={8} width={8} height={8} rx={1.3} />
        <rect x={11.5} y={11.5} width={8} height={8} rx={1.3} />
      </g>
    </svg>
  );
}
