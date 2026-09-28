-- National-quartile class of each cell's irradiation, against the Step 1 verdicts
-- (method 0.3.1-dev). Quartile bounds: evidence/2026-09-27-scoring-rules §B.
-- A cell without an irradiation value falls into the ELSE branch: the 51 rows
-- labelled "4 oberes Viertel" in the output are cells with no value, not upper-quartile cells.
SELECT CASE WHEN cv.value < 1101.6 THEN '1 unteres Viertel' WHEN cv.value < 1137.2 THEN '2 unteres Mittelfeld'
            WHEN cv.value < 1187.8 THEN '3 oberes Mittelfeld' ELSE '4 oberes Viertel' END q,
       sv.verdict, count(*)
FROM suitability_verdict sv
JOIN spatial_unit su ON su.id = sv.spatial_unit_id AND su.pilot_region = 'uckermark-12073'
LEFT JOIN criterion_value cv ON cv.spatial_unit_id = sv.spatial_unit_id AND cv.criterion_id = 'pv_irradiation_annual'
WHERE sv.technology = 'pv' AND sv.method_version = '0.3.1-dev'
GROUP BY 1, 2 ORDER BY 1, 2;
