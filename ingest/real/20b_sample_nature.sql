-- Step 20b: sample the peat map and the water balance onto the pilot region's
-- cells, for the outcome methods in docs/domain/scoring-criteria.md §4.
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='uckermark-12073' -f 20b_sample_nature.sql
--
-- Writes staging.raw_sample rows; 21_write_values.sql turns them into
-- criterion_value rows with their confidence. Idempotent via ON CONFLICT.
--
--   peat_share                     every cell  share covered by a soil class with a peat body (§4.1)
--   peat_organic_unassessed_share  every cell  share covered by Moor-/Anmoorgley or unclassified soil — not modelled in v1
--   peat_carbon_stock              cells with a carbon polygon  area-weighted t C/ha over the whole cell
--   water_percolation              cells the water balance covers  area-weighted mm/a
--   water_root_zone_moisture       idem, %nFK
--   water_wet_ref_*                peat cells  median and quartiles of wet peatland areas (§4.2 approximation)
--
-- Both LBGR layers and the Elementarflächen are free of overlaps (the LBGR
-- abstract: "überschneidungsfreie Karte"), so intersected areas are summed
-- without a union.

\set ON_ERROR_STOP on

CREATE TEMP TABLE cells AS
SELECT id, geom, ST_Area(geom) AS area
FROM spatial_unit
WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
CREATE INDEX ON cells USING gist (geom);
ANALYZE cells;

-- Soil classes (scoring-criteria.md §4.1). A peat body: KV1–3, HN1–3, or a
-- covered class whose lower layer is KV ("\" and "/" separate cover and
-- lower layer in the LBGR codes). Moorgley (GH), Anmoorgley (GM) and the
-- publisher's "unknown" are organic-rich or unclassified and not modelled in
-- v1. Gleye (GG) and mineral soils (YK,GG) are neither.
DROP TABLE IF EXISTS staging.peat_soil_sub;
CREATE TABLE staging.peat_soil_sub AS
SELECT CASE
         WHEN code ~ '^(KV[123]|HN[123])$' OR code ~ '[\\/]KV[123]$' THEN 'peat'
         WHEN code ~ '(^|[\\/])(GH|GM)$' OR code = 'unknown' THEN 'organic_unassessed'
         ELSE 'mineral'
       END AS kind,
       ST_Subdivide(geom, 128) AS geom
FROM staging.peat_soil;
CREATE INDEX ON staging.peat_soil_sub USING gist (geom);
ANALYZE staging.peat_soil_sub;

CREATE TEMP TABLE soil_share AS
SELECT c.id,
       coalesce(sum(ST_Area(ST_Intersection(c.geom, s.geom))) FILTER (WHERE s.kind = 'peat'), 0) / c.area AS peat,
       coalesce(sum(ST_Area(ST_Intersection(c.geom, s.geom))) FILTER (WHERE s.kind = 'organic_unassessed'), 0) / c.area AS organic
FROM cells c
LEFT JOIN staging.peat_soil_sub s ON ST_Intersects(c.geom, s.geom) AND s.kind <> 'mineral'
GROUP BY c.id, c.area;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT id, k.criterion, 'lbgr-bb-moorbodenkarte', least(k.share, 1), 'Flächenanteil'
FROM soil_share
CROSS JOIN LATERAL (VALUES ('peat_share', peat), ('peat_organic_unassessed_share', organic)) AS k(criterion, share)
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- Carbon stock: kg C/m² × 10 = t C/ha, area-weighted over the whole cell, so a
-- half-peat cell carries half the stock of its peat part.
DROP TABLE IF EXISTS staging.peat_carbon_sub;
CREATE TABLE staging.peat_carbon_sub AS
SELECT kg_c_per_m2, ST_Subdivide(geom, 128) AS geom FROM staging.peat_carbon;
CREATE INDEX ON staging.peat_carbon_sub USING gist (geom);
ANALYZE staging.peat_carbon_sub;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT c.id, 'peat_carbon_stock', 'lbgr-bb-moorbodenkarte',
       sum(ST_Area(ST_Intersection(c.geom, p.geom)) * p.kg_c_per_m2) / c.area * 10, 't C/ha'
FROM cells c
JOIN staging.peat_carbon_sub p ON ST_Intersects(c.geom, p.geom)
GROUP BY c.id, c.area
HAVING sum(ST_Area(ST_Intersection(c.geom, p.geom))) > 0
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- Water balance: area-weighted over the part of the cell the model covers.
DROP TABLE IF EXISTS staging.water_balance_sub;
CREATE TABLE staging.water_balance_sub AS
SELECT land_use, hydrotope, percolation_mm, soil_moisture_nfk, ST_Subdivide(geom, 128) AS geom
FROM staging.water_balance;
CREATE INDEX ON staging.water_balance_sub USING gist (geom);
ANALYZE staging.water_balance_sub;

CREATE TEMP TABLE water_parts AS
SELECT c.id, w.hydrotope, w.percolation_mm, w.soil_moisture_nfk, ST_Area(ST_Intersection(c.geom, w.geom)) AS covered
FROM cells c
JOIN staging.water_balance_sub w ON ST_Intersects(c.geom, w.geom);

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT id, k.criterion, 'lfu-bb-wasserhaushalt', k.value, k.unit
FROM (
  SELECT id,
         sum(percolation_mm * covered) / sum(covered) AS percolation,
         sum(soil_moisture_nfk * covered) / sum(covered) AS moisture
  FROM water_parts
  WHERE percolation_mm IS NOT NULL AND soil_moisture_nfk IS NOT NULL
  GROUP BY id
  HAVING sum(covered) > 0
) w
CROSS JOIN LATERAL (VALUES ('water_percolation', percolation, 'mm/a'), ('water_root_zone_moisture', moisture, '%nFK'))
  AS k(criterion, value, unit)
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

-- The restore approximation (§4.2): what a wet peatland (LANDNUTZ 1110,
-- "feuchte Moore") looks like in the same model. Reference areas are those
-- inside the pilot region; statistics are unweighted per Elementarfläche.
-- Median and quartiles, not a mean: a mean can lie outside the quartiles,
-- and the range must contain the value (ADR-0008 §2). A cell is matched on
-- its dominant hydrotope class when that class has at least 30 reference
-- areas (V6), otherwise on all reference areas in the region.
CREATE TEMP TABLE wet_reference AS
WITH ref AS (
  SELECT w.hydrotope, w.percolation_mm, w.soil_moisture_nfk
  FROM staging.water_balance w
  JOIN staging.pilot_boundary b ON ST_Intersects(w.geom, b.geom)
  WHERE w.land_use = 1110 AND w.percolation_mm IS NOT NULL AND w.soil_moisture_nfk IS NOT NULL
)
SELECT coalesce(hydrotope, '*') AS hydrotope, count(*) AS n,
       percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY percolation_mm) AS perc,
       percentile_cont(ARRAY[0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY soil_moisture_nfk) AS moist
FROM ref
GROUP BY GROUPING SETS ((hydrotope), ());

CREATE TEMP TABLE cell_hydrotope AS
SELECT DISTINCT ON (id) id, hydrotope
FROM (SELECT id, hydrotope, sum(covered) AS covered FROM water_parts GROUP BY id, hydrotope) x
ORDER BY id, covered DESC, hydrotope;

INSERT INTO staging.raw_sample (spatial_unit_id, criterion_id, source_id, raw_value, unit)
SELECT s.id, k.criterion, 'lfu-bb-wasserhaushalt', k.value, k.unit
FROM soil_share s
LEFT JOIN cell_hydrotope h ON h.id = s.id
LEFT JOIN wet_reference own ON own.hydrotope = h.hydrotope AND own.n >= 30
JOIN wet_reference region ON region.hydrotope = '*'
CROSS JOIN LATERAL (
  SELECT coalesce(own.perc, region.perc) AS perc, coalesce(own.moist, region.moist) AS moist
) r
CROSS JOIN LATERAL (VALUES
  ('water_wet_ref_percolation_p25', r.perc[1], 'mm/a'),
  ('water_wet_ref_percolation', r.perc[2], 'mm/a'),
  ('water_wet_ref_percolation_p75', r.perc[3], 'mm/a'),
  ('water_wet_ref_moisture_p25', r.moist[1], '%nFK'),
  ('water_wet_ref_moisture', r.moist[2], '%nFK'),
  ('water_wet_ref_moisture_p75', r.moist[3], '%nFK')
) AS k(criterion, value, unit)
WHERE s.peat > 0
ON CONFLICT (spatial_unit_id, criterion_id) DO UPDATE
  SET raw_value = EXCLUDED.raw_value, unit = EXCLUDED.unit, source_id = EXCLUDED.source_id;

SELECT hydrotope, n FROM wet_reference ORDER BY hydrotope;
