-- Roadmap Step 4: what the LfU Biotopkataster adds to the Uckermark cells.
-- Run after ingest/real/18_biotopkataster.sh and 23_habitat_overlap.sql.
\pset footer off
\echo '== overlaps by geometry kind =='
SELECT geometry_kind, count(*) AS overlaps, count(DISTINCT spatial_unit_id) AS cells,
       count(*) FILTER (WHERE protection_code IN ('1', '2')) AS protected, count(*) FILTER (WHERE lrt_code IS NOT NULL) AS with_lrt
FROM habitat_overlap ho JOIN spatial_unit su ON su.id = ho.spatial_unit_id
WHERE su.pilot_region = 'uckermark-12073' GROUP BY 1 ORDER BY 1;

\echo '== cells with at least one shown fact (area >= 1 % or any line/point) =='
WITH shown AS (
  SELECT ho.* FROM habitat_overlap ho JOIN spatial_unit su ON su.id = ho.spatial_unit_id
  WHERE su.pilot_region = 'uckermark-12073' AND (geometry_kind <> 'area' OR share >= 0.01)
)
SELECT count(DISTINCT spatial_unit_id) AS cells_with_fact,
       count(DISTINCT spatial_unit_id) FILTER (WHERE protection_code IN ('1', '2')) AS cells_with_protected,
       count(DISTINCT spatial_unit_id) FILTER (WHERE lrt_code IS NOT NULL) AS cells_with_lrt,
       (SELECT count(*) FROM spatial_unit WHERE pilot_region = 'uckermark-12073') AS cells_total
FROM shown;

\echo '== protected-biotope cells by PV class (real-pv-v1, 0.3.2-dev) =='
WITH prot AS (
  SELECT DISTINCT ho.spatial_unit_id FROM habitat_overlap ho JOIN spatial_unit su ON su.id = ho.spatial_unit_id
  WHERE su.pilot_region = 'uckermark-12073' AND protection_code IN ('1', '2') AND (geometry_kind <> 'area' OR share >= 0.01)
)
SELECT v.verdict, count(*) AS cells FROM prot JOIN suitability_verdict v
  ON v.spatial_unit_id = prot.spatial_unit_id AND v.technology = 'pv' AND v.method_version = '0.3.2-dev'
GROUP BY 1 ORDER BY 1;

\echo '== conservation grade of habitat types (all overlaps) =='
SELECT lrt_grade, count(*) FROM habitat_overlap WHERE lrt_code IS NOT NULL GROUP BY 1 ORDER BY 1;

\echo '== mapping method =='
SELECT mapping_method, count(*) FROM habitat_overlap GROUP BY 1 ORDER BY 1;
