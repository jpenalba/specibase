-- Run this once in the Supabase SQL Editor. The "cross" (plus-sign) marker
-- shape (added in 0018) overflowed the color/shape picker popup and has
-- been removed from the app. Any sample already styled with it falls back
-- to the default circle, and the check constraints are narrowed back to
-- match the remaining 7 shapes.

update projects set marker_shape = 'circle' where marker_shape = 'cross';
update project_marker_styles set shape = 'circle' where shape = 'cross';

alter table projects drop constraint if exists projects_marker_shape_check;
alter table projects add constraint projects_marker_shape_check
  check (marker_shape in ('circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'));

alter table project_marker_styles drop constraint if exists project_marker_styles_shape_check;
alter table project_marker_styles add constraint project_marker_styles_shape_check
  check (shape in ('circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'));
