// Zoom range of the unit vector tiles (ADR-0007), shared by the tile route and
// the explorer's source definition so the two cannot disagree.

/**
 * Lowest zoom tiles are served for — the whole Uckermark fits the screen here.
 * A 100 m cell is under a pixel wide at z9, so these low-zoom tiles are a
 * texture of verdicts, not a set of addressable units (see INTERACTIVE_MIN_ZOOM).
 */
export const MIN_UNIT_TILE_ZOOM = 9;
/**
 * From this zoom a cell is several pixels wide, and tiles carry each unit's id
 * and scores so it can be hovered, selected and listed. Below it they carry
 * only the three verdicts: ids are ~60 % of a tile's bytes (a z10 tile shrinks
 * from 1.9 MB to a fraction), and nobody can click a one-pixel cell.
 */
export const INTERACTIVE_MIN_ZOOM = 12;
/** Tiles above this are over-zoomed by MapLibre from z16 — a cell is already ~800 px across there. */
export const MAX_UNIT_TILE_ZOOM = 16;
/** Source-layer name inside each tile. */
export const UNIT_TILE_LAYER = "units";
