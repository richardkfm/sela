-- Step 23 (roadmap Step 4): every mapped biotope of the LfU Biotopkataster each
-- cell overlaps (habitat_overlap, migration 0009; docs/domain/decision-memo-habitat.md).
-- Areas with the share of the cell they cover, lines with their length inside
-- it, points by presence. Staged by 18_biotopkataster.sh.
-- Invoke with: psql "$DATABASE_URL" -v pilot_region='uckermark-12073' -f 23_habitat_overlap.sql
--
-- Every overlap is stored, however small; which ones a screen shows is a rule
-- in lib/scoring/habitat.ts. The Kataster's own caveats stand for every row:
-- digitised at 1:10 000, usable at 1:10 000 – 1:50 000, selective outside FFH
-- areas and Großschutzgebiete.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE cells AS
SELECT id, geom, ST_Area(geom) AS area
FROM spatial_unit
WHERE pilot_region = :'pilot_region' AND kind = 'hex_grid';
CREATE INDEX ON cells USING gist (geom);
ANALYZE cells;

-- Subdivided so a large biotope does not make every intersection test slow.
CREATE TEMP TABLE bio_parts AS
SELECT pk_ident, ST_Subdivide(geom, 128) AS geom FROM staging.bbk_fl WHERE geom IS NOT NULL;
CREATE INDEX ON bio_parts USING gist (geom);
ANALYZE bio_parts;

BEGIN;
DELETE FROM habitat_overlap ho USING spatial_unit su
WHERE su.id = ho.spatial_unit_id AND su.pilot_region = :'pilot_region';

-- Areas: share of the cell, taken against the union of a biotope's parts.
INSERT INTO habitat_overlap (
  spatial_unit_id, biotope_id, geometry_kind, biotope_code, biotope_name, protection_code, protection_text,
  lrt_code, lrt_name, lrt_grade, mapping_method, mapped_first, mapped_last, share, length_m, source_id)
SELECT s.id, b.pk_ident, 'area', b.biotyp, coalesce(b.biotyp_t, b.biotyp), b.bbgnat, b.bbgnat_t,
       nullif(nullif(b.ffhlrt, '0'), '-1'), CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE b.ffhlrt_t END,
       CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE nullif(b.ffhges, '-1') END,
       b.inten, b.datum_e, b.datum_f, least(s.share, 1), NULL, 'lfu-bb-biotopkataster'
FROM (
  SELECT c.id, p.pk_ident, ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area AS share
  FROM cells c JOIN bio_parts p ON ST_Intersects(c.geom, p.geom)
  GROUP BY c.id, c.geom, c.area, p.pk_ident
) s
JOIN staging.bbk_fl b ON b.pk_ident = s.pk_ident
WHERE s.share > 0 AND b.biotyp IS NOT NULL;

-- Lines: length inside the cell.
INSERT INTO habitat_overlap (
  spatial_unit_id, biotope_id, geometry_kind, biotope_code, biotope_name, protection_code, protection_text,
  lrt_code, lrt_name, lrt_grade, mapping_method, mapped_first, mapped_last, share, length_m, source_id)
SELECT c.id, b.pk_ident, 'line', b.biotyp, coalesce(b.biotyp_t, b.biotyp), b.bbgnat, b.bbgnat_t,
       nullif(nullif(b.ffhlrt, '0'), '-1'), CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE b.ffhlrt_t END,
       CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE nullif(b.ffhges, '-1') END,
       b.inten, b.datum_e, b.datum_f, NULL, ST_Length(ST_Intersection(c.geom, b.geom)), 'lfu-bb-biotopkataster'
FROM cells c JOIN staging.bbk_li b ON ST_Intersects(c.geom, b.geom)
WHERE b.biotyp IS NOT NULL AND ST_Length(ST_Intersection(c.geom, b.geom)) > 0
ON CONFLICT DO NOTHING;

-- Points: presence.
INSERT INTO habitat_overlap (
  spatial_unit_id, biotope_id, geometry_kind, biotope_code, biotope_name, protection_code, protection_text,
  lrt_code, lrt_name, lrt_grade, mapping_method, mapped_first, mapped_last, share, length_m, source_id)
SELECT c.id, b.pk_ident, 'point', b.biotyp, coalesce(b.biotyp_t, b.biotyp), b.bbgnat, b.bbgnat_t,
       nullif(nullif(b.ffhlrt, '0'), '-1'), CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE b.ffhlrt_t END,
       CASE WHEN b.ffhlrt IN ('0', '-1') OR b.ffhlrt IS NULL THEN NULL ELSE nullif(b.ffhges, '-1') END,
       b.inten, b.datum_e, b.datum_f, NULL, NULL, 'lfu-bb-biotopkataster'
FROM cells c JOIN staging.bbk_pu b ON ST_Intersects(c.geom, b.geom)
WHERE b.biotyp IS NOT NULL
ON CONFLICT DO NOTHING;
COMMIT;

SELECT geometry_kind, count(*) AS overlaps, count(DISTINCT spatial_unit_id) AS cells,
       count(*) FILTER (WHERE protection_code = '1') AS protected, count(*) FILTER (WHERE lrt_code IS NOT NULL) AS with_lrt
FROM habitat_overlap ho JOIN spatial_unit su ON su.id = ho.spatial_unit_id
WHERE su.pilot_region = :'pilot_region'
GROUP BY geometry_kind ORDER BY geometry_kind;
