// Zoom bands of the unit vector tiles (ADR-0007, ADR-0012), shared by the tile
// route, the materialiser and the explorer's source definition so none of
// them can disagree about what a tile at a given zoom contains.
//
// Below the cell zoom a tile carries the overview pyramid — aggregated
// hexagons of 1 km or 5 km, each with the most frequent class of its cells
// and that class's share — because a Land is a million 100 m cells and a
// 100 m cell is under a pixel wide until about zoom 10. From the cell zoom
// up, a tile carries the cells themselves, and from the interactive zoom also
// their ids and scores so they can be hovered, selected and listed.

/** Lowest zoom tiles are served for — both Länder fit the screen around here. */
export const MIN_UNIT_TILE_ZOOM = 5;

/**
 * The overview levels, from coarse to fine: the hexagon size in metres
 * (ST_HexagonGrid's size — the distance from centre to vertex; a 1 km
 * hexagon holds about 100 cells, a 5 km one about 2 500) and the highest zoom
 * the level is drawn at.
 */
export const OVERVIEW_LEVELS: readonly { readonly levelM: number; readonly maxZoom: number }[] = [
  { levelM: 5000, maxZoom: 7 },
  { levelM: 1000, maxZoom: 10 },
];

/**
 * From this zoom a tile carries the 100 m cells. A cell is 2–4 px wide here,
 * so the mosaic reads as texture; one tile holds up to ~15 000 cells.
 */
export const CELL_MIN_ZOOM = 11;

/**
 * From this zoom a cell is several pixels wide, and tiles carry each unit's id
 * and scores so it can be hovered, selected and listed. Below it they carry
 * only the three verdicts: ids are ~60 % of a tile's bytes, and nobody can
 * click a two-pixel cell.
 */
export const INTERACTIVE_MIN_ZOOM = 12;
/** Tiles above this are over-zoomed by MapLibre from z16 — a cell is already ~800 px across there. */
export const MAX_UNIT_TILE_ZOOM = 16;
/** Source-layer name inside each tile — the same for cells and overview hexagons, so one set of paint rules serves both. */
export const UNIT_TILE_LAYER = "units";

/** The overview level a zoom is drawn from, or null where the cells themselves are drawn. */
export function overviewLevelFor(zoom: number): number | null {
  if (zoom >= CELL_MIN_ZOOM) return null;
  for (const level of OVERVIEW_LEVELS) {
    if (zoom <= level.maxZoom) return level.levelM;
  }
  return null;
}

/**
 * Where a click below the interactive zoom takes the reader: the next band
 * down, not straight to the cells — from a Land-wide view a jump to a single
 * cell loses the place.
 */
export function zoomTargetAfterClick(zoom: number): number {
  const level = overviewLevelFor(zoom);
  if (level === null) return INTERACTIVE_MIN_ZOOM + 0.5;
  const index = OVERVIEW_LEVELS.findIndex((l) => l.levelM === level);
  const next = OVERVIEW_LEVELS[index + 1];
  return next ? next.maxZoom - 1 : INTERACTIVE_MIN_ZOOM + 0.5;
}
