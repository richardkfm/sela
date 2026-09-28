\set ON_ERROR_STOP on
\pset footer off
-- Step 2 evidence: the scored PV cells under illustrative-real-v1 (0.3.1-dev).
CREATE TEMP TABLE s AS
SELECT sv.spatial_unit_id id,
  (SELECT value FROM criterion_value cv WHERE cv.spatial_unit_id=sv.spatial_unit_id AND criterion_id='pv_irradiation_annual') irr,
  (SELECT value FROM criterion_value cv WHERE cv.spatial_unit_id=sv.spatial_unit_id AND criterion_id='pv_slope') slope,
  (SELECT value::int FROM criterion_value cv WHERE cv.spatial_unit_id=sv.spatial_unit_id AND criterion_id='pv_land_cover') clc,
  sv.score
FROM suitability_verdict sv JOIN spatial_unit su ON su.id = sv.spatial_unit_id AND su.pilot_region = 'uckermark-12073'
WHERE sv.technology='pv' AND sv.method_version='0.3.1-dev' AND sv.verdict IN ('suitable','unsuitable');
ALTER TABLE s ADD COLUMN irr_n float;
UPDATE s SET irr_n = CASE WHEN irr IS NULL THEN NULL ELSE least(greatest((irr-1050.5)/206.6,0),1) END;  -- greatest() ignores NULL

\echo == A. scored cells, raw and normalised quantiles
SELECT count(*) n, count(irr) with_irr,
  round(min(irr)::numeric,1) irr_min, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY irr)::numeric,1) irr_med, round(max(irr)::numeric,1) irr_max,
  round(min(irr_n)::numeric,3) irrn_min, round(max(irr_n)::numeric,3) irrn_max,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY slope)::numeric,2) sl_med,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY slope)::numeric,2) sl_p95,
  round(percentile_cont(0.99) WITHIN GROUP (ORDER BY slope)::numeric,2) sl_p99,
  round(max(slope)::numeric,2) sl_max,
  count(*) FILTER (WHERE slope>2) gt2, count(*) FILTER (WHERE slope>3) gt3, count(*) FILTER (WHERE slope>5) gt5
FROM s;

\echo == B. stored score quantiles
SELECT round(min(score)::numeric,3) mn, round(percentile_cont(0.05) WITHIN GROUP (ORDER BY score)::numeric,3) p5,
 round(percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::numeric,3) med, round(percentile_cont(0.95) WITHIN GROUP (ORDER BY score)::numeric,3) p95, round(max(score)::numeric,3) mx FROM s;

\echo == C. unsuitable cells by irradiation weight share w (slope 1-w), slope bound B deg, threshold t
WITH g AS (
  SELECT w, b, t,
    CASE WHEN irr_n IS NULL THEN 1-least(slope/b,1)
         ELSE w*irr_n + (1-w)*(1-least(slope/b,1)) END sc
  FROM s, (VALUES (0.25),(0.5),(0.75)) W(w), (VALUES (5.0),(10.0),(15.0)) B(b), (VALUES (0.4),(0.5),(0.6),(0.7)) T(t)
)
SELECT w, b, t, count(*) FILTER (WHERE sc < t) unsuitable, round(100.0*count(*) FILTER (WHERE sc < t)/count(*),1) pct
FROM g GROUP BY w,b,t ORDER BY w,b,t;

\echo == D. score variance share: var of each weighted component (w=0.5, B=10)
SELECT round(var_pop(0.5*irr_n)::numeric,5) var_irr_part, round(var_pop(0.5*(1-least(slope/10,1)))::numeric,5) var_slope_part,
  round(corr(irr_n, slope)::numeric,3) corr_irr_slope FROM s WHERE irr_n IS NOT NULL;

\echo == E. eingeschraenkt vs vorgesehen among scored cells
SELECT CASE WHEN clc IN (211,131,132) THEN 'vorgesehen' ELSE 'eingeschraenkt' END tier, count(*) FROM s GROUP BY 1 ORDER BY 1;
