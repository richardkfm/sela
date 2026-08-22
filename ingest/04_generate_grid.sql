-- Step 4 (roadmap §4.2): generate the hex grid via PostGIS ST_HexagonGrid,
-- clipped to the pilot boundary (ADR-0001). Invoke with:
--   psql "$DATABASE_URL" -v pilot_region='...' -v cell_size=100 -f 04_generate_grid.sql
--
-- Idempotent: a hex already present for this pilot_region (by exact
-- geometry) is not re-inserted. Cells only partially covered by the
-- boundary are excluded (ST_CoveredBy) rather than clipped — a clipped
-- edge cell would not be a hexagon and spatial_unit.geom is typed
-- geometry(Polygon, 25832); this is a stated v1 simplification, not a bug.

INSERT INTO spatial_unit (kind, pilot_region, geom)
SELECT 'hex_grid', :'pilot_region', hex.geom
FROM staging.pilot_boundary boundary
CROSS JOIN LATERAL ST_HexagonGrid(:cell_size, boundary.geom) AS hex(geom, i, j)
WHERE boundary.pilot_region = :'pilot_region'
  AND ST_CoveredBy(hex.geom, boundary.geom)
  AND NOT EXISTS (
    SELECT 1 FROM spatial_unit su
    WHERE su.pilot_region = :'pilot_region'
      AND su.kind = 'hex_grid'
      AND ST_Equals(su.geom, hex.geom)
  );
