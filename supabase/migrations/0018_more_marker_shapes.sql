-- Run this once in the Supabase SQL Editor. Widens the marker-shape check
-- constraints to the 4 new shapes added in src/lib/layer-shapes.ts
-- (pentagon, hexagon, star, cross), alongside the original 4.
--
-- Both constraints were created unnamed (inline column checks), so
-- Postgres gave them its default name (<table>_<column>_check) — drop
-- that by name, then add the widened version back under the same name.
-- Safe to re-run: the second run just drops what the first run added.

alter table projects drop constraint if exists projects_marker_shape_check;
alter table projects add constraint projects_marker_shape_check
  check (marker_shape in ('circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross'));

alter table project_marker_styles drop constraint if exists project_marker_styles_shape_check;
alter table project_marker_styles add constraint project_marker_styles_shape_check
  check (shape in ('circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross'));
