\echo '--- D. dominant CLC5 class per cell'
SELECT l.clc18, count(*) cells, round(100.0*count(*)/sum(count(*)) OVER (),2) pct,
       round(avg(l.share)::numeric,3) mean_share
FROM staging.land_cover_dominant l JOIN spatial_unit s ON s.id=l.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' GROUP BY 1 ORDER BY 2 DESC;
\echo '--- dominant class covers < half the cell'
SELECT count(*) cells, count(*) FILTER (WHERE share < 0.5) lt_half,
       round(100.0*count(*) FILTER (WHERE share < 0.5)/count(*),2) pct_lt_half,
       count(*) FILTER (WHERE share < 0.999) lt_full, round(100.0*count(*) FILTER (WHERE share < 0.999)/count(*),2) pct_lt_full,
       round(min(share)::numeric,3) min_share
FROM staging.land_cover_dominant l JOIN spatial_unit s ON s.id=l.spatial_unit_id WHERE s.pilot_region='uckermark-12073';
\echo '--- E. pv_slope (degrees, DGM200 value at cell centre)'
SELECT count(*) n, round(min(raw_value)::numeric,3) min,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY raw_value)::numeric,3) p50,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY raw_value)::numeric,3) p95,
  round(percentile_cont(0.99) WITHIN GROUP (ORDER BY raw_value)::numeric,3) p99,
  round(max(raw_value)::numeric,3) max,
  count(*) FILTER (WHERE raw_value > 5) gt5, round(100.0*count(*) FILTER (WHERE raw_value > 5)/count(*),3) pct_gt5,
  count(*) FILTER (WHERE raw_value > 10) gt10, round(100.0*count(*) FILTER (WHERE raw_value > 10)/count(*),3) pct_gt10,
  count(*) FILTER (WHERE raw_value = 0) eq0
FROM staging.raw_sample r JOIN spatial_unit s ON s.id=r.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND r.criterion_id='pv_slope';
