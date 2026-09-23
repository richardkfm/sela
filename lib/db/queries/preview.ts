// Geometry for the 3D parcel preview (ADR-0006). Every position, length,
// bearing and ring in the preview is computed here, in PostGIS — ADR-0002's
// binding rule ("TypeScript never computes geometry or raster math") holds
// for display geometry too. The client receives finished positions and only
// turns them into meshes.
//
// Metric work happens in the unit's stored CRS (EPSG:25832, ADR-0001) for
// the row layout, which follows the grid's own axes, and on `geography` for
// rings and viewpoints, so a 1 000 m ring is 1 000 m on the ground wherever
// the unit lies rather than 1 000 projected metres.

import { query } from "../client";
import type { GeoJSONFeatureCollection, GeoJSONPolygon } from "./spatial-units";
import type { SuitabilityVerdict, Technology } from "@/lib/scoring/types";

export interface PreviewUnit {
  readonly id: string;
  readonly pilotRegion: string;
  /** A point guaranteed to lie inside the unit — where a turbine's mast foot is drawn. */
  readonly anchor: readonly [number, number];
  readonly areaHa: number;
  /** Extent of the unit along the projected grid's axes, in metres. */
  readonly widthM: number;
  readonly depthM: number;
  readonly geometry: GeoJSONPolygon;
}

export interface PreviewRow {
  /** Midpoint of the row's centre line, lon/lat. */
  readonly position: readonly [number, number];
  readonly lengthM: number;
  /** Bearing of the row from its west end to its east end, degrees clockwise from true north. */
  readonly azimuthDeg: number;
  /** Support positions along the row, lon/lat. */
  readonly posts: readonly (readonly [number, number])[];
}

export interface PreviewRing {
  readonly radiusM: number;
  readonly geometry: GeoJSONPolygon;
  /** Point on the ring south-south-east of the anchor — where its label sits, on the near side of the ring for the default camera. */
  readonly labelPoint: readonly [number, number];
  /** Points on the ring at N, E, S, W — ground-level viewpoints looking back at the anchor. */
  readonly viewpoints: readonly { readonly bearingDeg: number; readonly position: readonly [number, number] }[];
}

interface UnitRow {
  id: string;
  pilot_region: string;
  lon: number;
  lat: number;
  area_ha: number;
  width_m: number;
  depth_m: number;
  geometry: string;
}

export async function getPreviewUnit(id: string): Promise<PreviewUnit | null> {
  const rows = await query<UnitRow>(
    `SELECT id, pilot_region,
            ST_X(ST_Transform(ST_PointOnSurface(geom), 4326)) AS lon,
            ST_Y(ST_Transform(ST_PointOnSurface(geom), 4326)) AS lat,
            ST_Area(geom) / 10000.0 AS area_ha,
            ST_XMax(geom) - ST_XMin(geom) AS width_m,
            ST_YMax(geom) - ST_YMin(geom) AS depth_m,
            ST_AsGeoJSON(ST_Transform(geom, 4326)) AS geometry
     FROM spatial_unit
     WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    pilotRegion: row.pilot_region,
    anchor: [Number(row.lon), Number(row.lat)],
    areaHa: Number(row.area_ha),
    widthM: Number(row.width_m),
    depthM: Number(row.depth_m),
    geometry: JSON.parse(row.geometry) as GeoJSONPolygon,
  };
}

interface RowSqlRow {
  lon: number;
  lat: number;
  length_m: number;
  azimuth_deg: number;
  posts: string;
}

/**
 * Parallel east–west rows filling the unit, inset from its boundary. Each
 * candidate line is clipped to the inset polygon, so rows end where the unit
 * does — whatever shape the unit is (ADR-0001: nothing above storage may
 * assume a hex cell).
 */
export async function listPreviewRows(
  id: string,
  layout: { rowPitchM: number; insetM: number; postSpacingM: number; minLengthM: number },
): Promise<PreviewRow[]> {
  const rows = await query<RowSqlRow>(
    `WITH inset AS (
       SELECT ST_Buffer(geom, -$2::float8) AS g FROM spatial_unit WHERE id = $1
     ),
     candidates AS (
       SELECT ST_Intersection(
                g,
                ST_SetSRID(ST_MakeLine(ST_MakePoint(ST_XMin(g) - 1, y::float8), ST_MakePoint(ST_XMax(g) + 1, y::float8)), ST_SRID(g))
              ) AS clipped
       FROM inset, generate_series((ST_YMin(g) + $3::float8 / 2)::numeric, ST_YMax(g)::numeric, $3::numeric) AS y
       WHERE NOT ST_IsEmpty(g)
     ),
     segments AS (
       SELECT (ST_Dump(clipped)).geom AS seg FROM candidates WHERE NOT ST_IsEmpty(clipped)
     )
     SELECT ST_X(ST_Transform(ST_LineInterpolatePoint(seg, 0.5), 4326)) AS lon,
            ST_Y(ST_Transform(ST_LineInterpolatePoint(seg, 0.5), 4326)) AS lat,
            ST_Length(seg) AS length_m,
            degrees(ST_Azimuth(
              ST_Transform(ST_StartPoint(seg), 4326)::geography,
              ST_Transform(ST_EndPoint(seg), 4326)::geography
            )) AS azimuth_deg,
            ST_AsGeoJSON(ST_Transform(
              ST_LineInterpolatePoints(seg, LEAST(1.0, $4::float8 / ST_Length(seg)), true), 4326
            )) AS posts
     FROM segments
     WHERE GeometryType(seg) = 'LINESTRING' AND ST_Length(seg) >= $5::float8
     ORDER BY lat DESC`,
    [id, layout.insetM, layout.rowPitchM, layout.postSpacingM, layout.minLengthM],
  );

  return rows.map((row) => {
    const posts = JSON.parse(row.posts) as { type: string; coordinates: number[] | number[][] };
    const coordinates =
      posts.type === "Point" ? [posts.coordinates as number[]] : (posts.coordinates as number[][]);
    return {
      position: [Number(row.lon), Number(row.lat)],
      lengthM: Number(row.length_m),
      azimuthDeg: Number(row.azimuth_deg),
      posts: coordinates.map(([lon, lat]) => [lon ?? 0, lat ?? 0] as const),
    };
  });
}

interface RingSqlRow {
  radius_m: number;
  geometry: string;
  label_lon: number;
  label_lat: number;
  viewpoints: { bearing: number; lon: number; lat: number }[];
}

/** Geodesic rings around the unit's anchor point, with a label point and four viewpoints each. */
export async function listPreviewRings(id: string, radiiM: readonly number[]): Promise<PreviewRing[]> {
  if (radiiM.length === 0) return [];
  const rows = await query<RingSqlRow>(
    `WITH anchor AS (
       SELECT ST_Transform(ST_PointOnSurface(geom), 4326)::geography AS p FROM spatial_unit WHERE id = $1
     )
     SELECT r AS radius_m,
            ST_AsGeoJSON(ST_Buffer(p, r, 'quad_segs=32')::geometry) AS geometry,
            ST_X(ST_Project(p, r, radians(150))::geometry) AS label_lon,
            ST_Y(ST_Project(p, r, radians(150))::geometry) AS label_lat,
            (SELECT json_agg(json_build_object(
                      'bearing', b,
                      'lon', ST_X(ST_Project(p, r, radians(b))::geometry),
                      'lat', ST_Y(ST_Project(p, r, radians(b))::geometry)) ORDER BY b)
             FROM unnest(ARRAY[0, 90, 180, 270]::float8[]) AS b) AS viewpoints
     FROM anchor, unnest($2::float8[]) AS r
     ORDER BY r`,
    [id, radiiM],
  );
  return rows.map((row) => ({
    radiusM: Number(row.radius_m),
    geometry: JSON.parse(row.geometry) as GeoJSONPolygon,
    labelPoint: [Number(row.label_lon), Number(row.label_lat)],
    viewpoints: row.viewpoints.map((v) => ({ bearingDeg: v.bearing, position: [v.lon, v.lat] as const })),
  }));
}

interface NeighbourRow {
  id: string;
  geometry: string;
  verdict: SuitabilityVerdict["verdict"] | null;
}

/** Units near the previewed one, with their verdict for one technology, drawn flat around it for context. */
export async function listPreviewNeighbours(
  id: string,
  technology: Technology,
  methodVersion: string,
  withinM: number,
): Promise<GeoJSONFeatureCollection> {
  const rows = await query<NeighbourRow>(
    `SELECT su.id, ST_AsGeoJSON(ST_Transform(su.geom, 4326)) AS geometry, sv.verdict
     FROM spatial_unit su
     JOIN spatial_unit target ON target.id = $1
     LEFT JOIN suitability_verdict sv
       ON sv.spatial_unit_id = su.id AND sv.technology = $2 AND sv.method_version = $3
     WHERE su.pilot_region = target.pilot_region
       AND ST_DWithin(su.geom, target.geom, $4::float8)`,
    [id, technology, methodVersion, withinM],
  );
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.id,
      properties: { id: row.id, verdict: row.verdict ?? "unscored", selected: row.id === id },
      geometry: JSON.parse(row.geometry) as GeoJSONPolygon,
    })),
  };
}
