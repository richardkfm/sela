\echo '--- B. Uckermark cells: pv_irradiation_annual raw (2016-2025 mean at cell centre)'
SELECT count(*) n, round(min(raw_value)::numeric,1) min,
  round(percentile_cont(0.05) WITHIN GROUP (ORDER BY raw_value)::numeric,1) p5,
  round(percentile_cont(0.25) WITHIN GROUP (ORDER BY raw_value)::numeric,1) p25,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY raw_value)::numeric,1) median,
  round(percentile_cont(0.75) WITHIN GROUP (ORDER BY raw_value)::numeric,1) p75,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY raw_value)::numeric,1) p95,
  round(max(raw_value)::numeric,1) max, count(DISTINCT raw_value) distinct_values
FROM staging.raw_sample r JOIN spatial_unit s ON s.id = r.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND r.criterion_id='pv_irradiation_annual';
\echo '--- cells without an irradiation value (fewer than 10 years at centre)'
SELECT count(*) FROM spatial_unit s WHERE s.pilot_region='uckermark-12073'
  AND NOT EXISTS (SELECT 1 FROM staging.raw_sample r WHERE r.spatial_unit_id=s.id AND r.criterion_id='pv_irradiation_annual');
\echo '--- criterion_value for pv_irradiation_annual (what scoring reads) matches raw?'
SELECT count(*), max(abs(cv.value - r.raw_value)) FROM criterion_value cv JOIN staging.raw_sample r
  ON r.spatial_unit_id=cv.spatial_unit_id AND r.criterion_id=cv.criterion_id WHERE cv.criterion_id='pv_irradiation_annual';
\echo '--- Germany-wide 2016-2025 per-pixel mean (scratch.de_mean, from awk over the ten .asc grids)'
SELECT count(*) n, round(min(mean)::numeric,1) min,
  round(percentile_cont(0.01) WITHIN GROUP (ORDER BY mean)::numeric,1) p1,
  round(percentile_cont(0.05) WITHIN GROUP (ORDER BY mean)::numeric,1) p5,
  round(percentile_cont(0.25) WITHIN GROUP (ORDER BY mean)::numeric,1) p25,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY mean)::numeric,1) median,
  round(percentile_cont(0.75) WITHIN GROUP (ORDER BY mean)::numeric,1) p75,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY mean)::numeric,1) p95,
  round(percentile_cont(0.99) WITHIN GROUP (ORDER BY mean)::numeric,1) p99,
  round(max(mean)::numeric,1) max
FROM scratch.de_mean;
\echo '--- exact p1/p99/min/max (unrounded) for use as bounds'
SELECT min(mean), percentile_cont(0.01) WITHIN GROUP (ORDER BY mean) p1, percentile_cont(0.99) WITHIN GROUP (ORDER BY mean) p99, max(mean) FROM scratch.de_mean;
\echo '--- percentile rank of Uckermark min/median/max within Germany distribution'
WITH u AS (SELECT min(raw_value) mn, percentile_cont(0.5) WITHIN GROUP (ORDER BY raw_value) md, max(raw_value) mx
           FROM staging.raw_sample WHERE criterion_id='pv_irradiation_annual')
SELECT round(100.0*(SELECT count(*) FROM scratch.de_mean WHERE mean < u.mn)/(SELECT count(*) FROM scratch.de_mean),1) pct_below_uck_min,
       round(100.0*(SELECT count(*) FROM scratch.de_mean WHERE mean < u.md)/(SELECT count(*) FROM scratch.de_mean),1) pct_below_uck_median,
       round(100.0*(SELECT count(*) FROM scratch.de_mean WHERE mean <= u.mx)/(SELECT count(*) FROM scratch.de_mean),1) pct_at_or_below_uck_max
FROM u;
\echo '--- current bounds 1000-1300 vs Germany mean: share of German pixels mapping to normalized score'
SELECT round(min((mean-1000)/300)::numeric,3) min_norm, round(max((mean-1000)/300)::numeric,3) max_norm FROM scratch.de_mean;
