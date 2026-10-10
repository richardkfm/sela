-- Step 4 (roadmap §4.2): generate the hex grid via PostGIS ST_HexagonGrid,
-- clipped to the region boundary (ADR-0001). Invoke with:
--   psql "$DATABASE_URL" -v pilot_region='...' -v cell_size=100 -f 04_generate_grid.sql
--
-- Idempotent: a hex already present for this pilot_region (by exact
-- geometry) is not re-inserted. ST_HexagonGrid is anchored at the origin of
-- the CRS, so a Landkreis's cells coincide with its Land's (ADR-0012). Cells
-- only partially covered by the boundary are excluded rather than clipped — a
-- clipped edge cell would not be a hexagon and spatial_unit.geom is typed
-- geometry(Polygon, 25832); this is a stated v1 simplification, not a bug.
--
-- "Covered" is decided against the boundary cut into small pieces
-- (ST_Subdivide), not against the whole polygon: a Land's boundary has
-- ~75 000 vertices and is TOASTed, and ST_CoveredBy(hex, boundary) detoasts
-- it for every one of a million hexagons — the Sachsen run spent a quarter of
-- an hour in that step on 2026-10-10 without finishing. Against the pieces, a
-- hex is covered exactly when the pieces' intersections add up to its whole
-- area (the pieces tile the polygon without overlap), which is the same set
-- of cells ST_CoveredBy gives — verified on the Uckermark: 117 191 cells
-- either way.

-- The NOT EXISTS check alone is not safe under concurrency: two runs started
-- together each see an empty region and both insert — this happened on
-- 2026-09-23 and doubled the Uckermark grid. A transaction-scoped advisory
-- lock per pilot region serialises runs; the second then finds every cell
-- present and inserts nothing.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

BEGIN;
SELECT pg_advisory_xact_lock(hashtext('04_generate_grid:' || :'pilot_region'));

CREATE TEMP TABLE boundary_part AS
SELECT ST_Subdivide(geom, 256) AS geom
FROM staging.pilot_boundary
WHERE pilot_region = :'pilot_region';
CREATE INDEX ON boundary_part USING gist (geom);
ANALYZE boundary_part;

INSERT INTO spatial_unit (kind, pilot_region, geom)
SELECT 'hex_grid', :'pilot_region', hex.geom
FROM (
  SELECT ST_SetSRID(ST_Extent(geom)::geometry, 25832) AS extent
  FROM staging.pilot_boundary WHERE pilot_region = :'pilot_region'
) b
CROSS JOIN LATERAL ST_HexagonGrid(:cell_size, b.extent) AS hex(geom, i, j)
WHERE EXISTS (SELECT 1 FROM boundary_part p WHERE p.geom && hex.geom)
  -- Covered: the pieces' intersections add up to the whole hexagon (1 mm² of
  -- floating-point slack on a 26 000 m² cell).
  AND (
    SELECT coalesce(sum(ST_Area(ST_Intersection(hex.geom, p.geom))), 0)
    FROM boundary_part p WHERE p.geom && hex.geom
  ) >= ST_Area(hex.geom) - 1e-6
  AND NOT EXISTS (
    SELECT 1 FROM spatial_unit su
    WHERE su.pilot_region = :'pilot_region'
      AND su.kind = 'hex_grid'
      -- && first, so the GiST index answers before ST_Equals runs: without it a
      -- Land's million cells would each be compared with every other.
      AND su.geom && hex.geom
      AND ST_Equals(su.geom, hex.geom)
  );

COMMIT;

SELECT count(*) AS cells FROM spatial_unit WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
