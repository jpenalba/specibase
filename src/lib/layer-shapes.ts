export type LayerShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star";

export const LAYER_SHAPES: LayerShape[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
];

export const DEFAULT_LAYER_SHAPE: LayerShape = "circle";

// Corner points for a regular polygon inscribed in a `size`x`size` box,
// `sides` corners starting at the top and going clockwise — shared by
// pentagon/hexagon below rather than writing out each one's coordinates
// by hand.
function regularPolygonPoints(sides: number, size: number, padding: number): [number, number][] {
  const half = size / 2;
  const radius = half - padding;
  const points: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (-90 + (i * 360) / sides) * (Math.PI / 180);
    points.push([half + radius * Math.cos(angle), half + radius * Math.sin(angle)]);
  }
  return points;
}

// Corner points for a shape inscribed in a `size`x`size` box, `padding` in
// from each edge (room for a stroke to sit fully inside the box rather
// than getting clipped). Circle has no polygon — draw it with an arc
// instead — so this returns null for it. Shared by the map's marker SVG
// and the PDF export's canvas drawing, so the two can't drift apart into
// visibly different shapes.
export function shapePolygonPoints(
  shape: LayerShape,
  size: number,
  padding: number
): [number, number][] | null {
  const half = size / 2;
  switch (shape) {
    case "square":
      return [
        [padding, padding],
        [size - padding, padding],
        [size - padding, size - padding],
        [padding, size - padding],
      ];
    case "triangle":
      return [
        [half, padding],
        [size - padding, size - padding],
        [padding, size - padding],
      ];
    case "diamond":
      return [
        [half, padding],
        [size - padding, half],
        [half, size - padding],
        [padding, half],
      ];
    case "pentagon":
      return regularPolygonPoints(5, size, padding);
    case "hexagon":
      return regularPolygonPoints(6, size, padding);
    case "star": {
      const outer = half - padding;
      const inner = outer * 0.45;
      const points: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (-90 + i * 36) * (Math.PI / 180);
        points.push([half + radius * Math.cos(angle), half + radius * Math.sin(angle)]);
      }
      return points;
    }
    case "circle":
      return null;
  }
}
