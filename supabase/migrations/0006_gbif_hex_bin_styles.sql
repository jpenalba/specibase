-- Switches saved GBIF layers from individual point/marker styles to
-- hex-bin polygon styles (see src/lib/gbif.ts) — a species saved before
-- this change has a style value (e.g. 'classic.point') that no longer
-- matches anything the app requests bin=hex with, so it would otherwise
-- keep rendering with the old, barely-visible point styling.
update gbif_species_layers
set style = 'classic.poly'
where style not in ('classic.poly', 'purpleYellow.poly', 'green.poly');
