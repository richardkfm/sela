-- Verdicts after `pnpm db:materialize` under real-pv-v1 (method 0.3.2-dev), both regions.
SELECT su.pilot_region, sv.technology, sv.verdict, sv.excluded_by_criterion_id, count(*),
       count(*) FILTER (WHERE protection_flag_count > 0) AS flagged
FROM suitability_verdict sv JOIN spatial_unit su ON su.id = sv.spatial_unit_id
WHERE sv.method_version = '0.3.2-dev'
GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3;
