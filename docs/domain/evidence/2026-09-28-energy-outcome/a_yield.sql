-- Roadmap Step 3 (pv-yield-v1) on the Uckermark: coverage per status and class,
-- and the spread of the yield. Run after `pnpm db:materialize -- --pilot-region=uckermark-12073`.
\pset footer off
\echo '== develop_pv rows by metric and status =='
SELECT o.metric, o.status, count(*) AS cells
FROM outcome o JOIN spatial_unit su ON su.id = o.spatial_unit_id
WHERE su.pilot_region = 'uckermark-12073' AND o.method_version = 'pv-yield-v1' AND o.scenario = 'develop_pv'
GROUP BY 1, 2 ORDER BY 1, 2;

\echo '== develop_pv yield status by PV class (verdicts 0.3.2-dev) =='
SELECT v.verdict, o.status, count(*) AS cells
FROM outcome o
JOIN spatial_unit su ON su.id = o.spatial_unit_id
JOIN suitability_verdict v ON v.spatial_unit_id = o.spatial_unit_id AND v.technology = 'pv' AND v.method_version = '0.3.2-dev'
WHERE su.pilot_region = 'uckermark-12073' AND o.method_version = 'pv-yield-v1' AND o.scenario = 'develop_pv'
  AND o.metric = 'pv_annual_yield'
GROUP BY 1, 2 ORDER BY 1, 2;

\echo '== yield spread over modelled cells, MWh/ha·a (central, low, high) =='
SELECT round(min(value)::numeric, 0) AS min_central, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY value)::numeric, 0) AS median_central,
       round(max(value)::numeric, 0) AS max_central,
       round(min(value_low)::numeric, 0) AS min_low, round(max(value_high)::numeric, 0) AS max_high,
       round((100 * (max(value) / min(value) - 1))::numeric, 1) AS spread_pct
FROM outcome o JOIN spatial_unit su ON su.id = o.spatial_unit_id
WHERE su.pilot_region = 'uckermark-12073' AND o.method_version = 'pv-yield-v1' AND o.scenario = 'develop_pv'
  AND o.metric = 'pv_annual_yield' AND o.status = 'modelled';

\echo '== share of modelled cells whose range contains the region-best central value =='
WITH m AS (
  SELECT value, value_low, value_high FROM outcome o JOIN spatial_unit su ON su.id = o.spatial_unit_id
  WHERE su.pilot_region = 'uckermark-12073' AND o.method_version = 'pv-yield-v1' AND o.scenario = 'develop_pv'
    AND o.metric = 'pv_annual_yield' AND o.status = 'modelled'
), best AS (SELECT max(value) AS b FROM m)
SELECT count(*) FILTER (WHERE value_high >= b) AS contains_best, count(*) AS modelled FROM m, best;

\echo '== other scenarios =='
SELECT o.scenario, o.status, count(*) AS rows
FROM outcome o JOIN spatial_unit su ON su.id = o.spatial_unit_id
WHERE su.pilot_region = 'uckermark-12073' AND o.method_version = 'pv-yield-v1' AND o.metric = 'pv_annual_yield'
GROUP BY 1, 2 ORDER BY 1, 2;
