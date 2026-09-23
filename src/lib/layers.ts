import { SampleRecord } from "./samples-store";
import { Project, SampleProjectLink } from "./projects-store";
import { MAIN_DATABASE_COLOR, colorForProjectIndex } from "./layer-colors";
import { LayerShape, DEFAULT_LAYER_SHAPE } from "./layer-shapes";

export type MapLayer = {
  id: string; // "all" or the project id
  label: string;
  color: string;
  shape: LayerShape;
  sampleIds: Set<string>;
  // When set, a sample in this layer draws with its own entry here instead
  // of the layer's flat color/shape above — used by a project's Samples
  // tab when it's coloring/shaping markers by a field (species, etc)
  // rather than one style for every sample. Samples with no entry fall
  // back to the layer's own color/shape.
  sampleStyles?: Map<string, { color: string; shape: LayerShape }>;
  // When set (alongside sampleStyles), the map's PDF export draws one
  // legend line per entry here instead of a single line for the layer.
  legendEntries?: { label: string; color: string; shape: LayerShape; count: number }[];
};

export type LayerStyle = { color?: string; shape?: LayerShape };

export const ALL_LAYER_ID = "all";

// "Main database" is always the root layer (every sample); each project is
// a child layer scoped to the samples linked to it. A sample can appear in
// more than one project's layer, same as it can belong to more than one
// project in the data model.
//
// `styleOverrides` carries manual color/shape picks (keyed by layer id) on
// top of the automatic per-index assignment — a layer with no override
// just gets its usual color and the default shape.
export function buildLayers(
  samples: SampleRecord[],
  projects: Project[],
  links: SampleProjectLink[],
  styleOverrides?: Map<string, LayerStyle>
): { root: MapLayer; children: MapLayer[] } {
  const rootStyle = styleOverrides?.get(ALL_LAYER_ID);
  const root: MapLayer = {
    id: ALL_LAYER_ID,
    label: "Main database",
    color: rootStyle?.color ?? MAIN_DATABASE_COLOR,
    shape: rootStyle?.shape ?? DEFAULT_LAYER_SHAPE,
    sampleIds: new Set(samples.map((s) => s.id)),
  };

  const children: MapLayer[] = projects.map((project, index) => {
    const style = styleOverrides?.get(project.id);
    return {
      id: project.id,
      label: project.name,
      color: style?.color ?? colorForProjectIndex(index),
      shape: style?.shape ?? DEFAULT_LAYER_SHAPE,
      sampleIds: new Set(
        links.filter((l) => l.project_id === project.id).map((l) => l.sample_id)
      ),
    };
  });

  return { root, children };
}
