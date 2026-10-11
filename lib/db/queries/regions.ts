// Region-scale reads for the map explorer (ADR-0007, ADR-0012): which region
// to show, where it sits in the Land › Landkreis hierarchy, its extent, the
// per-class counts for the legend, the vector tiles themselves — cells or the
// overview pyramid, by zoom — and the sources whose data the tiles carry. All
// geometry work — tile clipping, simplification, encoding — is PostGIS's
// (ST_AsMVTGeom/ST_AsMVT), per ADR-0002.

import { query } from "../client";
import type { SourceRow } from "./criteria";
import type { BBox } from "./spatial-units";
import { INTERACTIVE_MIN_ZOOM, UNIT_TILE_LAYER, overviewLevelFor } from "@/lib/map/tiles";
import { FIXTURE_PILOT_REGION, pilotRegionInfo, type PilotRegionInfo, type RegionLevel } from "@/lib/pilot-region";
import type { SuitabilityVerdictLabel, Technology } from "@/lib/scoring/types";

/**
 * Which cells a region shows (ADR-0012): the cells of a grid region, or — for a
 * Landkreis of a Land grid — the parent's cells stamped with the Kreis's AGS.
 * Resolved once per request; every region-scoped read takes it, so no query
 * has to know which of the two a region is.
 */
export interface RegionScope {
  readonly id: string;
  readonly gridRegion: string;
  readonly kreisAgs: string | null;
}

/** The WHERE fragment selecting a scope's cells, with its positional parameters starting at `from`. */
export function scopeWhere(scope: RegionScope, alias = "su", from = 1): { sql: string; params: string[] } {
  if (scope.kreisAgs) {
    return {
      sql: `${alias}.pilot_region = $${from} AND left(${alias}.ags, 5) = $${from + 1}`,
      params: [scope.gridRegion, scope.kreisAgs],
    };
  }
  return { sql: `${alias}.pilot_region = $${from}`, params: [scope.gridRegion] };
}

/** A region as the navigation needs it: where it sits and whether it has cells to show. */
export interface RegionNode {
  readonly id: string;
  readonly level: RegionLevel;
  readonly nameDe: string;
  readonly bez: string | null;
  readonly ags: string | null;
  readonly parentId: string | null;
  readonly unitCount: number;
}

export interface RegionSummary extends PilotRegionInfo {
  readonly scope: RegionScope;
  readonly bez: string | null;
  readonly unitCount: number;
  readonly bbox: BBox | null;
  readonly parent: RegionNode | null;
  /** The Landkreise of a Land that have cells, alphabetically; empty for a Kreis or the fixture. */
  readonly children: readonly RegionNode[];
  /** Whether the overview pyramid has been materialised — without it the map is empty below the cell zoom, and says so. */
  readonly hasOverview: boolean;
}

interface RegionRow {
  id: string;
  kind: RegionLevel;
  ags: string | null;
  name: string;
  bez: string | null;
  parent_id: string | null;
  unit_count: string;
  has_grid: boolean;
}

// Which regions have a grid of their own is read by walking the index on
// spatial_unit.pilot_region one distinct value at a time (a recursive "skip
// scan": a handful of index probes). Asked per region as a correlated EXISTS,
// the planner expected a match early and scanned all 1.8 million cells for
// every Kreis that has none — 18 scans, 7.5 s, for Brandenburg's children.
const GRID_REGIONS = `WITH RECURSIVE grid_regions AS (
    (SELECT pilot_region FROM spatial_unit ORDER BY pilot_region LIMIT 1)
    UNION ALL
    SELECT (SELECT su.pilot_region FROM spatial_unit su WHERE su.pilot_region > g.pilot_region ORDER BY su.pilot_region LIMIT 1)
    FROM grid_regions g WHERE g.pilot_region IS NOT NULL
  )`;
const REGION_SELECT = `${GRID_REGIONS}
  SELECT r.id, r.kind, r.ags, r.name, r.bez, r.parent_id, r.unit_count,
    r.id IN (SELECT pilot_region FROM grid_regions WHERE pilot_region IS NOT NULL) AS has_grid
  FROM region r`;

function toNode(row: RegionRow): RegionNode {
  return {
    id: row.id,
    level: row.kind,
    nameDe: row.name,
    bez: row.bez,
    ags: row.ags,
    parentId: row.parent_id,
    unitCount: Number(row.unit_count),
  };
}

async function regionRow(id: string): Promise<RegionRow | null> {
  const rows = await query<RegionRow>(`${REGION_SELECT} WHERE r.id = $1`, [id]);
  return rows[0] ?? null;
}

function scopeOf(row: RegionRow): RegionScope | null {
  if (row.has_grid) return { id: row.id, gridRegion: row.id, kreisAgs: null };
  if (row.kind === "kreis" && row.parent_id && row.ags && Number(row.unit_count) > 0) {
    return { id: row.id, gridRegion: row.parent_id, kreisAgs: row.ags };
  }
  return null;
}

/** The scope of a region that has cells to show, or null. */
export async function resolveScope(regionId: string): Promise<RegionScope | null> {
  const row = await regionRow(regionId);
  return row ? scopeOf(row) : null;
}

/**
 * The region to show: the one asked for if it has cells, otherwise the first
 * of the default, the fixture and any region at all that does. A database
 * that only holds the fixture (CI) therefore still gets a working explorer
 * without configuration.
 */
export async function resolveRegion(requested: string | null, fallback: string): Promise<string | null> {
  for (const candidate of [requested, fallback, FIXTURE_PILOT_REGION]) {
    if (candidate && (await resolveScope(candidate))) return candidate;
  }
  const rows = await query<{ id: string }>(
    `SELECT id FROM region WHERE unit_count > 0 ORDER BY kind = 'fixture', kind = 'kreis', id LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

/** Every region with cells to show, Länder first, for the region switch. */
export async function listAvailableRegions(): Promise<RegionNode[]> {
  const rows = await query<RegionRow>(
    `${REGION_SELECT} WHERE r.unit_count > 0 ORDER BY r.kind = 'fixture', r.kind = 'kreis', r.name`,
  );
  return rows.map(toNode);
}

export async function getRegionSummary(regionId: string): Promise<RegionSummary | null> {
  const row = await regionRow(regionId);
  if (!row) return null;
  const scope = scopeOf(row);
  if (!scope) return null;

  const [parentRows, childRows, bboxRows, overviewRows] = await Promise.all([
    row.parent_id
      ? query<RegionRow>(`${REGION_SELECT} WHERE r.id = $1`, [row.parent_id])
      : Promise.resolve([] as RegionRow[]),
    query<RegionRow>(
      `${REGION_SELECT} WHERE r.parent_id = $1 AND r.unit_count > 0 ORDER BY r.name`,
      [row.id],
    ),
    regionBBox(row.id, scope),
    query<{ has: boolean }>(`SELECT EXISTS (SELECT 1 FROM unit_overview WHERE region_id = $1) AS has`, [row.id]),
  ]);

  return {
    ...pilotRegionInfo(row.id),
    nameDe: row.name,
    bez: row.bez,
    scope,
    unitCount: Number(row.unit_count),
    bbox: bboxRows,
    parent: parentRows[0] ? toNode(parentRows[0]) : null,
    children: childRows.map(toNode),
    hasOverview: overviewRows[0]?.has ?? false,
  };
}

/** The region's boundary extent in EPSG:4326, or — where no boundary is loaded — the extent of its cells. */
async function regionBBox(regionId: string, scope: RegionScope): Promise<BBox | null> {
  const fromBoundary = await query<{ west: number | null; south: number; east: number; north: number }>(
    `SELECT ST_XMin(e) AS west, ST_YMin(e) AS south, ST_XMax(e) AS east, ST_YMax(e) AS north
     FROM (SELECT ST_Extent(ST_Transform(geom, 4326)) AS e FROM region WHERE id = $1 AND geom IS NOT NULL) x`,
    [regionId],
  );
  const b = fromBoundary[0];
  if (b && b.west !== null) return [Number(b.west), Number(b.south), Number(b.east), Number(b.north)];

  const where = scopeWhere(scope);
  const rows = await query<{ west: number | null; south: number; east: number; north: number }>(
    `SELECT ST_XMin(e) AS west, ST_YMin(e) AS south, ST_XMax(e) AS east, ST_YMax(e) AS north
     FROM (SELECT ST_Extent(ST_Transform(su.geom, 4326)) AS e FROM spatial_unit su WHERE ${where.sql}) x`,
    where.params,
  );
  const row = rows[0];
  return row && row.west !== null ? [Number(row.west), Number(row.south), Number(row.east), Number(row.north)] : null;
}

/**
 * A region's boundary for the map, in EPSG:4326, simplified to 25 m — display
 * only, well inside VG25's 1:25 000 precision; the grid is clipped against the
 * full-precision file in ingest/regions/, never this.
 */
export async function getRegionOutline(
  regionId: string,
): Promise<{ id: string; nameDe: string; bez: string | null; geometry: unknown; sourceId: string | null } | null> {
  const rows = await query<{ id: string; name: string; bez: string | null; source_id: string | null; geometry: string }>(
    `SELECT id, name, bez, source_id, ST_AsGeoJSON(ST_Transform(ST_SimplifyPreserveTopology(geom, 25), 4326), 6) AS geometry
     FROM region WHERE id = $1 AND geom IS NOT NULL`,
    [regionId],
  );
  const row = rows[0];
  return row
    ? { id: row.id, nameDe: row.name, bez: row.bez, geometry: JSON.parse(row.geometry), sourceId: row.source_id }
    : null;
}

export type VerdictCounts = Record<SuitabilityVerdictLabel | "unscored", number>;

const EMPTY_COUNTS: VerdictCounts = {
  suitable: 0,
  unsuitable: 0,
  excluded: 0,
  not_considered: 0,
  restricted: 0,
  unrestricted: 0,
  unscored: 0,
};

/**
 * Units per verdict class for one technology — the legend's numbers, for the
 * whole region. Read from region_verdict_count (written at materialisation,
 * ADR-0012); counted live only on an install that has migrated but not yet
 * re-materialised.
 */
export async function countVerdicts(scope: RegionScope, technology: Technology, methodVersion: string): Promise<VerdictCounts> {
  const stored = await query<{ verdict: string; n: string }>(
    `SELECT verdict, n FROM region_verdict_count WHERE region_id = $1 AND technology = $2 AND method_version = $3`,
    [scope.id, technology, methodVersion],
  );
  const counts: VerdictCounts = { ...EMPTY_COUNTS };
  const rows =
    stored.length > 0
      ? stored
      : await (async () => {
          const where = scopeWhere(scope, "su", 3);
          return query<{ verdict: string | null; n: string }>(
            `SELECT coalesce(sv.verdict, 'unscored') AS verdict, count(*) AS n
             FROM spatial_unit su
             LEFT JOIN suitability_verdict sv
               ON sv.spatial_unit_id = su.id AND sv.technology = $1 AND sv.method_version = $2
             WHERE ${where.sql}
             GROUP BY 1`,
            [technology, methodVersion, ...where.params],
          );
        })();
  for (const row of rows) {
    const key = (row.verdict ?? "unscored") as keyof VerdictCounts;
    if (key in counts) counts[key] = Number(row.n);
  }
  return counts;
}

/**
 * One Mapbox Vector Tile of a region. From CELL_MIN_ZOOM each feature is a
 * cell carrying, for every technology, its verdict (`v_pv`, …) — so switching
 * technology on the map is a paint change, not a refetch — and from
 * INTERACTIVE_MIN_ZOOM also its id, scores (`s_pv`, …) and whether it carries
 * a Prüfhinweis (`h_pv`, `h_agripv`; ADR-0009). Below CELL_MIN_ZOOM each
 * feature is an overview hexagon (ADR-0012) carrying the *most frequent* class
 * of its cells under the same `v_*` keys — so the same paint rules apply —
 * plus `n` (cells), `p_*` (the share of that class) and `lvl` (metres). A unit
 * without a verdict has no `v_*` property; the map draws it as "nicht bewertet".
 */
export async function unitTile(scope: RegionScope, z: number, x: number, y: number, methodVersion: string): Promise<Buffer> {
  const level = overviewLevelFor(z);
  if (level !== null) return overviewTile(scope, level, z, x, y, methodVersion);

  const interactive = z >= INTERACTIVE_MIN_ZOOM;
  const where = scopeWhere(scope, "su", 5);
  const rows = await query<{ tile: Buffer }>(
    `WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS env),
     features AS (
       SELECT ST_AsMVTGeom(su.geom_3857, bounds.env, 4096, 64, true) AS geom,
              ${
                interactive
                  ? `su.id::text AS id, pv.score::float8 AS s_pv, ag.score::float8 AS s_agripv, wi.score::float8 AS s_wind,
                     (pv.protection_flag_count > 0) AS h_pv, (ag.protection_flag_count > 0) AS h_agripv,`
                  : ""
              }
              pv.verdict AS v_pv, ag.verdict AS v_agripv, wi.verdict AS v_wind
       FROM spatial_unit su
       CROSS JOIN bounds
       LEFT JOIN suitability_verdict pv ON pv.spatial_unit_id = su.id AND pv.technology = 'pv' AND pv.method_version = $4
       LEFT JOIN suitability_verdict ag ON ag.spatial_unit_id = su.id AND ag.technology = 'agripv' AND ag.method_version = $4
       LEFT JOIN suitability_verdict wi ON wi.spatial_unit_id = su.id AND wi.technology = 'wind' AND wi.method_version = $4
       WHERE ${where.sql} AND su.geom_3857 && bounds.env
     )
     SELECT ST_AsMVT(features, '${UNIT_TILE_LAYER}', 4096, 'geom') AS tile FROM features WHERE geom IS NOT NULL`,
    [z, x, y, methodVersion, ...where.params],
  );
  return rows[0]?.tile ?? Buffer.alloc(0);
}

async function overviewTile(scope: RegionScope, levelM: number, z: number, x: number, y: number, methodVersion: string): Promise<Buffer> {
  const rows = await query<{ tile: Buffer }>(
    `WITH bounds AS (SELECT ST_TileEnvelope($1, $2, $3) AS env),
     features AS (
       SELECT ST_AsMVTGeom(o.geom_3857, bounds.env, 4096, 64, true) AS geom,
              o.n_cells AS n, o.level_m AS lvl,
              o.d_pv AS v_pv, o.d_agripv AS v_agripv, o.d_wind AS v_wind,
              o.s_pv::float8 AS p_pv, o.s_agripv::float8 AS p_agripv, o.s_wind::float8 AS p_wind
       FROM unit_overview o
       CROSS JOIN bounds
       WHERE o.region_id = $4 AND o.level_m = $5 AND o.method_version = $6 AND o.geom_3857 && bounds.env
     )
     SELECT ST_AsMVT(features, '${UNIT_TILE_LAYER}', 4096, 'geom') AS tile FROM features WHERE geom IS NOT NULL`,
    [z, x, y, scope.id, levelM, methodVersion],
  );
  return rows[0]?.tile ?? Buffer.alloc(0);
}

const SOURCE_SELECT = `SELECT s.id, s.dataset, s.publisher, s.version, to_char(s.retrieved_at, 'YYYY-MM-DD') AS retrieved_at,
            s.licence, s.redistributable, s.url, s.attribution, s.attribution_url, s.change_notice_required
     FROM source s`;

interface SourceDbRow {
  id: string;
  dataset: string;
  publisher: string;
  version: string | null;
  retrieved_at: string | null;
  licence: string;
  redistributable: boolean;
  url: string | null;
  attribution: string;
  attribution_url: string | null;
  change_notice_required: boolean;
}

function toSourceRow(r: SourceDbRow): SourceRow {
  return {
    id: r.id,
    dataset: r.dataset,
    publisher: r.publisher,
    version: r.version,
    retrievedAt: r.retrieved_at,
    licence: r.licence,
    redistributable: r.redistributable,
    url: r.url,
    attribution: r.attribution,
    attributionUrl: r.attribution_url,
    changeNoticeRequired: r.change_notice_required,
  };
}

/**
 * Every source whose data reaches the map for this region — the ones cited by
 * its criterion values. docs/data/sources.md §7 condition 4: the notice must
 * be on the screen that shows the data, so the map's attribution control
 * carries these alongside the basemap's. Read from region_source (written at
 * materialisation); derived live only where that is empty.
 */
export async function listRegionSources(scope: RegionScope): Promise<SourceRow[]> {
  const stored = await query<SourceDbRow>(
    `${SOURCE_SELECT} WHERE s.id IN (SELECT source_id FROM region_source WHERE region_id = $1) ORDER BY s.id`,
    [scope.id],
  );
  if (stored.length > 0) return stored.map(toSourceRow);
  const where = scopeWhere(scope, "su", 1);
  const rows = await query<SourceDbRow>(
    `${SOURCE_SELECT}
     WHERE s.id IN (
       SELECT DISTINCT cv.source_id
       FROM criterion_value cv JOIN spatial_unit su ON su.id = cv.spatial_unit_id
       WHERE ${where.sql}
     )
     ORDER BY s.id`,
    where.params,
  );
  return rows.map(toSourceRow);
}
