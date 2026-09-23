// Region-scale reads for the map explorer (ADR-0007): which region to show,
// its extent, per-class counts for the legend, the vector tiles themselves,
// and the sources whose data the tiles carry. All geometry work — tile
// clipping, simplification, encoding — is PostGIS's (ST_AsMVTGeom/ST_AsMVT),
// per ADR-0002.

import { query } from "../client";
import type { SourceRow } from "./criteria";
import type { BBox } from "./spatial-units";
import { INTERACTIVE_MIN_ZOOM, UNIT_TILE_LAYER } from "@/lib/map/tiles";
import { FIXTURE_PILOT_REGION, pilotRegionInfo, type PilotRegionInfo } from "@/lib/pilot-region";
import type { SuitabilityVerdictLabel, Technology } from "@/lib/scoring/types";

export interface RegionSummary extends PilotRegionInfo {
  readonly unitCount: number;
  readonly bbox: BBox | null;
}

async function unitCounts(): Promise<Map<string, number>> {
  const rows = await query<{ pilot_region: string; n: string }>(
    `SELECT pilot_region, count(*) AS n FROM spatial_unit GROUP BY pilot_region`,
  );
  return new Map(rows.map((r) => [r.pilot_region, Number(r.n)]));
}

/**
 * The region to show: the one asked for if it has units, otherwise the first
 * of the default and the fixture that does. A database that only holds the
 * fixture (CI) therefore still gets a working explorer without configuration.
 */
export async function resolvePilotRegion(requested: string | null, fallback: string): Promise<string> {
  const counts = await unitCounts();
  for (const candidate of [requested, fallback, FIXTURE_PILOT_REGION]) {
    if (candidate && (counts.get(candidate) ?? 0) > 0) return candidate;
  }
  return requested ?? fallback;
}

/** Regions that actually have units in this database, for the region switch. */
export async function listAvailableRegions(): Promise<PilotRegionInfo[]> {
  const counts = await unitCounts();
  return [...counts.keys()].sort().map(pilotRegionInfo);
}

export async function getRegionSummary(pilotRegion: string): Promise<RegionSummary> {
  const rows = await query<{ n: string; west: number | null; south: number; east: number; north: number }>(
    `SELECT n, ST_XMin(e) AS west, ST_YMin(e) AS south, ST_XMax(e) AS east, ST_YMax(e) AS north
     FROM (
       SELECT count(*) AS n, ST_Extent(ST_Transform(geom, 4326)) AS e FROM spatial_unit WHERE pilot_region = $1
     ) agg`,
    [pilotRegion],
  );
  const row = rows[0];
  return {
    ...pilotRegionInfo(pilotRegion),
    unitCount: Number(row?.n ?? 0),
    bbox:
      row && row.west !== null
        ? [Number(row.west), Number(row.south), Number(row.east), Number(row.north)]
        : null,
  };
}

export type VerdictCounts = Record<SuitabilityVerdictLabel | "unscored", number>;

/** Units per verdict class for one technology — the legend's numbers, for the whole region. */
export async function countVerdicts(
  pilotRegion: string,
  technology: Technology,
  methodVersion: string,
): Promise<VerdictCounts> {
  const rows = await query<{ verdict: string | null; n: string }>(
    `SELECT sv.verdict, count(*) AS n
     FROM spatial_unit su
     LEFT JOIN suitability_verdict sv
       ON sv.spatial_unit_id = su.id AND sv.technology = $2 AND sv.method_version = $3
     WHERE su.pilot_region = $1
     GROUP BY sv.verdict`,
    [pilotRegion, technology, methodVersion],
  );
  const counts: VerdictCounts = { suitable: 0, unsuitable: 0, excluded: 0, unscored: 0 };
  for (const row of rows) {
    const key = (row.verdict ?? "unscored") as keyof VerdictCounts;
    counts[key] = Number(row.n);
  }
  return counts;
}

/**
 * One Mapbox Vector Tile of a region's units. Each feature carries, for every
 * technology, its verdict (`v_pv`, …) — so switching technology on the map is
 * a paint change, not a refetch — and from INTERACTIVE_MIN_ZOOM also its id and
 * scores (`s_pv`, …). A unit without a verdict has no `v_*` property; the map
 * draws it as "nicht bewertet".
 */
export async function unitTile(
  pilotRegion: string,
  z: number,
  x: number,
  y: number,
  methodVersion: string,
): Promise<Buffer> {
  const interactive = z >= INTERACTIVE_MIN_ZOOM;
  const rows = await query<{ tile: Buffer }>(
    `WITH bounds AS (SELECT ST_TileEnvelope($2, $3, $4) AS env),
     features AS (
       SELECT ST_AsMVTGeom(su.geom_3857, bounds.env, 4096, 64, true) AS geom,
              ${interactive ? "su.id::text AS id, pv.score::float8 AS s_pv, ag.score::float8 AS s_agripv, wi.score::float8 AS s_wind," : ""}
              pv.verdict AS v_pv, ag.verdict AS v_agripv, wi.verdict AS v_wind
       FROM spatial_unit su
       CROSS JOIN bounds
       LEFT JOIN suitability_verdict pv ON pv.spatial_unit_id = su.id AND pv.technology = 'pv' AND pv.method_version = $5
       LEFT JOIN suitability_verdict ag ON ag.spatial_unit_id = su.id AND ag.technology = 'agripv' AND ag.method_version = $5
       LEFT JOIN suitability_verdict wi ON wi.spatial_unit_id = su.id AND wi.technology = 'wind' AND wi.method_version = $5
       WHERE su.pilot_region = $1 AND su.geom_3857 && bounds.env
     )
     SELECT ST_AsMVT(features, '${UNIT_TILE_LAYER}', 4096, 'geom') AS tile FROM features WHERE geom IS NOT NULL`,
    [pilotRegion, z, x, y, methodVersion],
  );
  return rows[0]?.tile ?? Buffer.alloc(0);
}

/**
 * Every source whose data reaches the map for this region — the ones cited by
 * its criterion values. docs/data/sources.md §7 condition 4: the notice must
 * be on the screen that shows the data, so the map's attribution control
 * carries these alongside the basemap's.
 */
export async function listRegionSources(pilotRegion: string): Promise<SourceRow[]> {
  const rows = await query<{
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
  }>(
    `SELECT s.id, s.dataset, s.publisher, s.version, to_char(s.retrieved_at, 'YYYY-MM-DD') AS retrieved_at,
            s.licence, s.redistributable, s.url, s.attribution, s.attribution_url, s.change_notice_required
     FROM source s
     WHERE s.id IN (
       SELECT DISTINCT cv.source_id
       FROM criterion_value cv JOIN spatial_unit su ON su.id = cv.spatial_unit_id
       WHERE su.pilot_region = $1
     )
     ORDER BY s.id`,
    [pilotRegion],
  );
  return rows.map((r) => ({
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
  }));
}
