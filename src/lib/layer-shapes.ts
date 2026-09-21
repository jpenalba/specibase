export type LayerShape = "circle" | "square" | "triangle" | "diamond";

export const LAYER_SHAPES: LayerShape[] = ["circle", "square", "triangle", "diamond"];

export const DEFAULT_LAYER_SHAPE: LayerShape = "circle";

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
    case "circle":
      return null;
  }
}
