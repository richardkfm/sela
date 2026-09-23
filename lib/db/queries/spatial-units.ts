// Reads of `spatial_unit` (lib/db/migrations/0002_domain_schema.sql).
// Geometry is stored in EPSG:25832 (ADR-0001) and reprojected to EPSG:4326
// at the serving edge here, per roadmap §4.1 — never in TypeScript itself
// (ADR-0002); ST_Transform/ST_AsGeoJSON are PostGIS built-ins, not
// application geometry math.

import { query } from "../client";

/** Minimal GeoJSON shapes — avoids pulling in @types/geojson for this alone. */
export interface GeoJSONPolygon {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly (readonly number[])[])[];
}

export interface GeoJSONFeature {
  readonly type: "Feature";
  readonly id: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly geometry: GeoJSONPolygon;
}

export interface GeoJSONFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly GeoJSONFeature[];
}

export interface SpatialUnit {
  readonly id: string;
  readonly kind: "hex_grid" | "flurstueck";
  readonly pilotRegion: string;
  /** GeoJSON Polygon geometry, EPSG:4326. */
  readonly geometry: GeoJSONPolygon;
}

interface SpatialUnitRow {
  id: string;
  kind: "hex_grid" | "flurstueck";
  pilot_region: string;
  geometry: string;
}

function toSpatialUnit(row: SpatialUnitRow): SpatialUnit {
  return {
    id: row.id,
    kind: row.kind,
    pilotRegion: row.pilot_region,
    geometry: JSON.parse(row.geometry) as GeoJSONPolygon,
  };
}

/** Just the ids for a pilot region — cheaper than listSpatialUnitsGeoJSON for callers that don't need geometry. */
export async function listSpatialUnitIds(pilotRegion: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM spatial_unit WHERE pilot_region = $1 ORDER BY id`,
    [pilotRegion],
  );
  return rows.map((row) => row.id);
}

export async function getSpatialUnitById(id: string): Promise<SpatialUnit | null> {
  const rows = await query<SpatialUnitRow>(
    `SELECT id, kind, pilot_region, ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
     FROM spatial_unit
     WHERE id = $1`,
    [id],
  );
  return rows[0] ? toSpatialUnit(rows[0]) : null;
}

/** West, south, east, north in EPSG:4326 — computed by PostGIS, so the client can frame a unit without doing geometry. */
export type BBox = readonly [number, number, number, number];

interface SpatialUnitMapRow extends SpatialUnitRow {
  area_ha: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * A GeoJSON FeatureCollection of every spatial unit in a pilot region, for
 * the map explorer. Each feature carries its own `bbox` and `areaHa` as
 * properties — the explorer frames and describes a selected unit from these
 * rather than measuring coordinates itself (ADR-0002).
 */
export async function listSpatialUnitsGeoJSON(pilotRegion: string): Promise<GeoJSONFeatureCollection> {
  const rows = await query<SpatialUnitMapRow>(
    `WITH u AS (SELECT id, kind, pilot_region, geom, ST_Transform(geom, 4326) AS g FROM spatial_unit WHERE pilot_region = $1)
     SELECT id, kind, pilot_region, ST_AsGeoJSON(g) AS geometry,
            ST_Area(geom) / 10000.0 AS area_ha,
            ST_XMin(g) AS west, ST_YMin(g) AS south, ST_XMax(g) AS east, ST_YMax(g) AS north
     FROM u
     ORDER BY id`,
    [pilotRegion],
  );
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.id,
      properties: {
        id: row.id,
        kind: row.kind,
        areaHa: Number(row.area_ha),
        bbox: [Number(row.west), Number(row.south), Number(row.east), Number(row.north)] satisfies BBox,
      },
      geometry: JSON.parse(row.geometry) as GeoJSONPolygon,
    })),
  };
}

/** The extent of a pilot region's units, or null if it has none. */
export async function getPilotRegionExtent(pilotRegion: string): Promise<BBox | null> {
  const rows = await query<{ west: number | null; south: number; east: number; north: number }>(
    `SELECT ST_XMin(e) AS west, ST_YMin(e) AS south, ST_XMax(e) AS east, ST_YMax(e) AS north
     FROM (SELECT ST_Extent(ST_Transform(geom, 4326)) AS e FROM spatial_unit WHERE pilot_region = $1) extent`,
    [pilotRegion],
  );
  const row = rows[0];
  if (!row || row.west === null) return null;
  return [Number(row.west), Number(row.south), Number(row.east), Number(row.north)];
}
