import { LayerShape } from "@/lib/layer-shapes";

// Shared between the layer panel's swatch/picker and the map's markers, so
// "what a shape looks like" is defined in exactly one place.
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
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {shape === "circle" && <circle cx={half} cy={half} r={half - 1} fill={color} />}
      {shape === "square" && (
        <rect x={1} y={1} width={size - 2} height={size - 2} fill={color} />
      )}
      {shape === "triangle" && (
        <polygon points={`${half},1 ${size - 1},${size - 1} 1,${size - 1}`} fill={color} />
      )}
      {shape === "diamond" && (
        <polygon points={`${half},1 ${size - 1},${half} ${half},${size - 1} 1,${half}`} fill={color} />
      )}
    </svg>
  );
}
