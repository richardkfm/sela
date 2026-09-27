\set ON_ERROR_STOP on
\pset footer off
-- Measurement for the Step 1 follow-up: tiers, verdicts without land cover, Q5 variants, flags.
CREATE TEMP TABLE tier(clc int PRIMARY KEY, tier text);
INSERT INTO tier VALUES
 (211,'vorgesehen'),(131,'vorgesehen'),(132,'vorgesehen'),
 (231,'eingeschraenkt'),(221,'eingeschraenkt'),(222,'eingeschraenkt'),(242,'eingeschraenkt'),(243,'eingeschraenkt'),
 (121,'eingeschraenkt'),(123,'eingeschraenkt'),(124,'eingeschraenkt'),(133,'eingeschraenkt');

CREATE TEMP TABLE c AS
SELECT su.id,
  (SELECT raw_value FROM staging.raw_sample r WHERE r.spatial_unit_id=su.id AND criterion_id='pv_irradiation_annual') irr,
  (SELECT raw_value FROM staging.raw_sample r WHERE r.spatial_unit_id=su.id AND criterion_id='pv_slope') slope,
  (SELECT raw_value::int FROM staging.raw_sample r WHERE r.spatial_unit_id=su.id AND criterion_id='pv_land_cover') clc,
  (SELECT raw_value FROM staging.raw_sample r WHERE r.spatial_unit_id=su.id AND criterion_id='pv_protection_status') nsg
FROM spatial_unit su WHERE su.pilot_region='uckermark-12073';
ALTER TABLE c ADD COLUMN tier text, ADD COLUMN irr_n float, ADD COLUMN slope_n float, ADD COLUMN score float;
UPDATE c SET tier = coalesce((SELECT t.tier FROM tier t WHERE t.clc=c.clc),'nicht_vorgesehen'),
  irr_n = least(greatest((irr-1050.5)/(1257.1-1050.5),0),1),
  slope_n = 1-least(greatest(slope/10,0),1);
UPDATE c SET score = (coalesce(irr_n,0)+coalesce(slope_n,0))/((irr_n IS NOT NULL)::int+(slope_n IS NOT NULL)::int);

\echo == tiers x NSG exclusion
SELECT tier, count(*) FILTER (WHERE nsg>=0.5) excluded_nsg, count(*) FILTER (WHERE nsg<0.5) not_excluded, count(*) total FROM c GROUP BY 1 ORDER BY 1;

\echo == verdict among not-excluded cells, score = mean(irr 4b, slope 0-10), threshold 0.5
SELECT tier, count(*) FILTER (WHERE score>=0.5) suitable, count(*) FILTER (WHERE score<0.5) unsuitable,
  round(min(score)::numeric,3) min, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::numeric,3) med, round(max(score)::numeric,3) max
FROM c WHERE nsg<0.5 GROUP BY 1 ORDER BY 1;

\echo == regional spread of normalised values (not-excluded, tier <> nicht_vorgesehen)
SELECT round(percentile_cont(0.05) WITHIN GROUP (ORDER BY irr_n)::numeric,3) irr_p5, round(percentile_cont(0.95) WITHIN GROUP (ORDER BY irr_n)::numeric,3) irr_p95,
       round(max(irr_n)::numeric,3) irr_max,
       round(percentile_cont(0.05) WITHIN GROUP (ORDER BY slope_n)::numeric,3) sl_p5, round(percentile_cont(0.95) WITHIN GROUP (ORDER BY slope_n)::numeric,3) sl_p95,
       round(max(slope_n)::numeric,3) sl_max
FROM c WHERE nsg<0.5 AND tier<>'nicht_vorgesehen';

-- Q5 variant A (literal): criteria whose regional p5-p95 spread >= 0.1 count as varying (both do);
-- name the larger shortfall (w=1/2 each after normalising weights) if >= 0.1.
\echo == Q5 A: absolute shortfall (1-n)/2 >= 0.1 among varying criteria
WITH s AS (SELECT (1-irr_n)/2 si, (1-slope_n)/2 ss FROM c WHERE nsg<0.5 AND tier<>'nicht_vorgesehen' AND irr_n IS NOT NULL)
SELECT CASE WHEN greatest(si,ss)<0.1 THEN 'none' WHEN si>=ss THEN 'irradiation' ELSE 'slope' END named, count(*) FROM s GROUP BY 1 ORDER BY 1;

\echo == Q5 B: shortfall against the best value in the compared land, (best-n)/2 >= 0.05 and >= 0.1
WITH b AS (SELECT max(irr_n) bi, max(slope_n) bs FROM c WHERE nsg<0.5 AND tier<>'nicht_vorgesehen'),
s AS (SELECT (b.bi-irr_n)/2 si, (b.bs-slope_n)/2 ss FROM c, b WHERE nsg<0.5 AND tier<>'nicht_vorgesehen' AND irr_n IS NOT NULL)
SELECT t, CASE WHEN greatest(si,ss)<t THEN 'none' WHEN si>=ss THEN 'irradiation' ELSE 'slope' END named, count(*)
FROM s, (VALUES (0.05),(0.1)) v(t) GROUP BY 1,2 ORDER BY 1,2;

\echo == Q5 B unweighted (best-n) >= 0.1
WITH b AS (SELECT max(irr_n) bi, max(slope_n) bs FROM c WHERE nsg<0.5 AND tier<>'nicht_vorgesehen'),
s AS (SELECT (b.bi-irr_n) si, (b.bs-slope_n) ss FROM c, b WHERE nsg<0.5 AND tier<>'nicht_vorgesehen' AND irr_n IS NOT NULL)
SELECT CASE WHEN greatest(si,ss)<0.1 THEN 'none' WHEN si>=ss THEN 'irradiation' ELSE 'slope' END named, count(*) FROM s GROUP BY 1 ORDER BY 1;

-- Flags: per-category share for cells that are not NSG-excluded.
CREATE TEMP TABLE psub AS SELECT category, ST_Subdivide(geom,128) geom FROM staging.protection WHERE category IN ('ffh','spa','lsg','br');
CREATE INDEX ON psub USING gist(geom); ANALYZE psub;
CREATE TEMP TABLE cg AS SELECT c.id, su.geom, ST_Area(su.geom) area, c.nsg, c.tier FROM c JOIN spatial_unit su ON su.id=c.id WHERE c.nsg<0.5;
CREATE INDEX ON cg USING gist(geom); ANALYZE cg;
CREATE TEMP TABLE fs AS
SELECT cg.id, p.category, ST_Area(ST_Intersection(cg.geom, ST_Union(p.geom)))/cg.area share
FROM cg JOIN psub p ON ST_Intersects(cg.geom,p.geom) GROUP BY cg.id, p.category, cg.geom, cg.area;

\echo == flags among not-excluded cells (share > 0), and how many are slivers
SELECT category, count(*) any_overlap, count(*) FILTER (WHERE share<0.01) under_1pct, count(*) FILTER (WHERE share>=0.5) half_or_more FROM fs GROUP BY 1 ORDER BY 1;
SELECT 'nsg_partial' category, count(*) FILTER (WHERE nsg>0) any_overlap, count(*) FILTER (WHERE nsg>0 AND nsg<0.01) under_1pct FROM c WHERE nsg<0.5;
\echo == not-excluded cells with at least one PV flag (ffh/spa/lsg share>=0.01 or nsg partial>=0.01), by tier
SELECT c.tier, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM fs WHERE fs.id=c.id AND fs.category IN ('ffh','spa','lsg') AND fs.share>=0.01) OR c.nsg>=0.01) flagged, count(*) total
FROM c WHERE c.nsg<0.5 GROUP BY 1 ORDER BY 1;
