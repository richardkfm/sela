// Reads of `municipality` (lib/db/migrations/0008_municipality.sql) and the
// point-in-cell lookup behind flow F1's coordinate search. Geometry work —
// containment, reprojection, simplification for display — is PostGIS's
// (ADR-0002); TypeScript only matches names.

import { query } from "../client";
import { scopeWhere, type RegionScope } from "./regions";
import type { BBox } from "./spatial-units";

export interface Municipality {
  readonly ags: string;
  readonly name: string;
  /** VG25 BEZ, e.g. "Stadt", "Gemeinde". */
  readonly kind: string;
  readonly bbox: BBox;
}

interface MunicipalityRow {
  ags: string;
  name: string;
  kind: string;
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Every Gemeinde of a region, alphabetically — a Landkreis has a few dozen, a
 * Land a few hundred; the name match runs in TypeScript. The Gemeinden are
 * loaded per grid region; a Landkreis view takes those with its AGS prefix.
 */
export async function listMunicipalities(scope: RegionScope): Promise<Municipality[]> {
  const rows = await query<MunicipalityRow>(
    `SELECT ags, name, kind, ST_XMin(g) AS west, ST_YMin(g) AS south, ST_XMax(g) AS east, ST_YMax(g) AS north
     FROM (
       SELECT ags, name, kind, ST_Transform(geom, 4326) AS g
       FROM municipality
       WHERE pilot_region = $1 ${scope.kreisAgs ? "AND left(ags, 5) = $2" : ""}
     ) m
     ORDER BY name`,
    scope.kreisAgs ? [scope.gridRegion, scope.kreisAgs] : [scope.gridRegion],
  );
  return rows.map((r) => ({
    ags: r.ags,
    name: r.name,
    kind: r.kind,
    bbox: [Number(r.west), Number(r.south), Number(r.east), Number(r.north)],
  }));
}

/**
 * One Gemeinde's outline for the map, in EPSG:4326, simplified to 10 m —
 * display only, well inside VG25's 1:25 000 precision; nothing is computed on it.
 */
export async function getMunicipalityOutline(
  ags: string,
): Promise<{ ags: string; name: string; kind: string; geometry: unknown } | null> {
  const rows = await query<{ ags: string; name: string; kind: string; geometry: string }>(
    `SELECT ags, name, kind, ST_AsGeoJSON(ST_Transform(ST_SimplifyPreserveTopology(geom, 10), 4326), 6) AS geometry
     FROM municipality WHERE ags = $1`,
    [ags],
  );
  const row = rows[0];
  return row ? { ags: row.ags, name: row.name, kind: row.kind, geometry: JSON.parse(row.geometry) } : null;
}

/**
 * The Gemeinde each unit lies in — the one containing a point on the unit's
 * surface, stamped on the cell at ingest (`spatial_unit.ags`, ADR-0012), so a
 * cell on a municipal border is named once. Units outside every loaded
 * Gemeinde (the fixture) are absent from the map.
 */
export async function municipalitiesForUnits(ids: readonly string[]): Promise<Map<string, { ags: string; name: string }>> {
  if (ids.length === 0) return new Map();
  const rows = await query<{ id: string; ags: string; name: string }>(
    `SELECT u.id, m.ags, m.name
     FROM spatial_unit u
     JOIN municipality m ON m.ags = u.ags
     WHERE u.id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, { ags: r.ags, name: r.name }]));
}

/**
 * The unit of a region containing a point given in `epsg` (4326 as lon/lat,
 * or an ETRS89 / UTM zone), or null when the point lies in none.
 */
export async function findUnitAt(scope: RegionScope, x: number, y: number, epsg: 4326 | 25832 | 25833): Promise<string | null> {
  const where = scopeWhere(scope, "su", 4);
  const rows = await query<{ id: string }>(
    `SELECT su.id FROM spatial_unit su
     WHERE ${where.sql} AND ST_Contains(su.geom, ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), $3::integer), 25832))
     LIMIT 1`,
    [x, y, epsg, ...where.params],
  );
  return rows[0]?.id ?? null;
}
