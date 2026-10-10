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
-- it for every one of a million hexagons — the Sachsen run spent 26 minutes
-- in that step on 2026-10-10 without finishing. Set-based, in three passes,
-- because correlated subqueries over the pieces planned badly (8 minutes for
-- the Uckermark against 9 seconds): every hexagon is paired with the pieces
-- it touches; a hexagon wholly inside one piece is covered (a predicate, no
-- overlay — nearly every interior cell); for the rest, the pieces'
-- intersections must add up to the whole hexagon (the pieces tile the polygon
-- without overlap). The same set of cells ST_CoveredBy gives — verified on the
-- Uckermark: 117 191 cells either way.

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

-- Every hexagon of the boundary's extent, paired with each piece it touches.
CREATE TEMP TABLE hex_part AS
SELECT hex.i, hex.j, hex.geom, p.geom AS part
FROM (
  SELECT ST_SetSRID(ST_Extent(geom)::geometry, 25832) AS extent
  FROM staging.pilot_boundary WHERE pilot_region = :'pilot_region'
) b
CROSS JOIN LATERAL ST_HexagonGrid(:cell_size, b.extent) AS hex(geom, i, j)
JOIN boundary_part p ON p.geom && hex.geom;
CREATE INDEX ON hex_part (i, j);
ANALYZE hex_part;

-- Pass 1: wholly inside one piece.
CREATE TEMP TABLE covered AS
SELECT DISTINCT ON (i, j) i, j, geom
FROM hex_part
WHERE ST_Covers(part, geom)
ORDER BY i, j;
CREATE UNIQUE INDEX ON covered (i, j);

-- Pass 2: across pieces — the intersections add up to the whole hexagon
-- (1 mm² of floating-point slack on a 26 000 m² cell).
INSERT INTO covered (i, j, geom)
SELECT hp.i, hp.j, hp.geom
FROM hex_part hp
WHERE NOT EXISTS (SELECT 1 FROM covered c WHERE c.i = hp.i AND c.j = hp.j)
GROUP BY hp.i, hp.j, hp.geom
HAVING sum(ST_Area(ST_Intersection(hp.geom, hp.part))) >= ST_Area(hp.geom) - 1e-6;

INSERT INTO spatial_unit (kind, pilot_region, geom)
SELECT 'hex_grid', :'pilot_region', c.geom
FROM covered c
WHERE NOT EXISTS (
  SELECT 1 FROM spatial_unit su
  WHERE su.pilot_region = :'pilot_region'
    AND su.kind = 'hex_grid'
    -- && first, so the GiST index answers before ST_Equals runs: without it a
    -- Land's million cells would each be compared with every other.
    AND su.geom && c.geom
    AND ST_Equals(su.geom, c.geom)
);

DROP TABLE hex_part;
DROP TABLE covered;
DROP TABLE boundary_part;
COMMIT;

SELECT count(*) AS cells FROM spatial_unit WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
