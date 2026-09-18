import { SampleRecord } from "./samples-store";
import { Project, SampleProjectLink } from "./projects-store";
import { MAIN_DATABASE_COLOR, colorForProjectIndex } from "./layer-colors";

export type MapLayer = {
  id: string; // "all" or the project id
  label: string;
  color: string;
  sampleIds: Set<string>;
};

export const ALL_LAYER_ID = "all";

// "Main database" is always the root layer (every sample); each project is
// a child layer scoped to the samples linked to it. A sample can appear in
// more than one project's layer, same as it can belong to more than one
// project in the data model.
export function buildLayers(
  samples: SampleRecord[],
  projects: Project[],
  links: SampleProjectLink[]
): { root: MapLayer; children: MapLayer[] } {
  const root: MapLayer = {
    id: ALL_LAYER_ID,
    label: "Main database",
    color: MAIN_DATABASE_COLOR,
    sampleIds: new Set(samples.map((s) => s.id)),
  };

  const children: MapLayer[] = projects.map((project, index) => ({
    id: project.id,
    label: project.name,
    color: colorForProjectIndex(index),
    sampleIds: new Set(
      links.filter((l) => l.project_id === project.id).map((l) => l.sample_id)
    ),
  }));

  return { root, children };
}
