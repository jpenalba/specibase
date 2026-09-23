import { LayerShape, shapePolygonPoints } from "@/lib/layer-shapes";

// Shared between the layer panel's swatch/picker and the map's markers (via
// shapePolygonPoints, which this and the live marker/PDF export all call),
// so "what a shape looks like" is defined in exactly one place.
export function LayerShapeIcon({
  shape,
  color,
  size = 14,
}: {
  shape: LayerShape;
  color: string;
  size?: number;
}) {
  const half = size / 2;
  const padding = 1;

  if (shape === "circle") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={half} cy={half} r={half - padding} fill={color} />
      </svg>
    );
  }

  const points = shapePolygonPoints(shape, size, padding)!;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <polygon points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill={color} />
    </svg>
  );
}
