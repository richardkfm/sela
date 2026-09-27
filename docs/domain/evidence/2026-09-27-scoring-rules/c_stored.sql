\echo '--- C. stored suitability_verdict, technology pv, uckermark-12073'
SELECT v.method_version, v.verdict, count(*), round(100.0*count(*)/sum(count(*)) OVER (),2) pct
FROM suitability_verdict v JOIN spatial_unit s ON s.id=v.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND v.technology='pv' GROUP BY 1,2 ORDER BY 1,2;
\echo '--- limiting / excluded_by by verdict'
SELECT v.verdict, coalesce(v.limiting_criterion_id, 'excluded_by:'||v.excluded_by_criterion_id) crit, count(*),
  round(100.0*count(*)/sum(count(*)) OVER (PARTITION BY v.verdict),2) pct_of_verdict
FROM suitability_verdict v JOIN spatial_unit s ON s.id=v.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND v.technology='pv' GROUP BY 1,2 ORDER BY 1,3 DESC;
\echo '--- limiting overall among scored (non-excluded) cells'
SELECT v.limiting_criterion_id, count(*), round(100.0*count(*)/sum(count(*)) OVER (),2) pct
FROM suitability_verdict v JOIN spatial_unit s ON s.id=v.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND v.technology='pv' AND v.verdict<>'excluded' GROUP BY 1 ORDER BY 2 DESC;
\echo '--- agripv / wind verdict counts for reference'
SELECT v.technology, v.verdict, count(*) FROM suitability_verdict v JOIN spatial_unit s ON s.id=v.spatial_unit_id
WHERE s.pilot_region='uckermark-12073' AND v.technology<>'pv' GROUP BY 1,2 ORDER BY 1,2;
\echo '--- score distribution (pv, scored cells)'
SELECT round(min(score)::numeric,3) min, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY score)::numeric,3) med, round(max(score)::numeric,3) max
FROM suitability_verdict v JOIN spatial_unit s ON s.id=v.spatial_unit_id WHERE s.pilot_region='uckermark-12073' AND v.technology='pv' AND score IS NOT NULL;
