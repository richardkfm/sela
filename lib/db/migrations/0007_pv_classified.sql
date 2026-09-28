-- Roadmap Step 2 (docs/product/roadmap-pilot-demo.md): the first confirmed PV
-- method, `real-pv-v1`, decided by the project owner on 2026-09-28
-- (docs/domain/decision-memo-pv-method.md; ADR-0009, amendment 1).
--
-- PV is classified, not scored: no weighted score and no geeignet/ungeeignet.
-- A cell that is neither excluded nor `not_considered` is placed by its
-- land-cover tier — `restricted` ("eingeschränkt") or `unrestricted` ("ohne
-- Einschränkung"). Like the other classified states it carries no score and
-- names the criterion that placed it (excluded_by_criterion_id, read as
-- "decided by"). `suitable`/`unsuitable` stay for the synthetic fixture, whose
-- illustrative weighted score is unchanged.

ALTER TABLE suitability_verdict DROP CONSTRAINT suitability_verdict_verdict_check;
ALTER TABLE suitability_verdict DROP CONSTRAINT suitability_verdict_state_check;
ALTER TABLE suitability_verdict ADD CONSTRAINT suitability_verdict_verdict_check
  CHECK (verdict IN ('suitable', 'unsuitable', 'excluded', 'not_considered', 'restricted', 'unrestricted'));
ALTER TABLE suitability_verdict ADD CONSTRAINT suitability_verdict_state_check CHECK (
  (verdict IN ('excluded', 'not_considered', 'restricted', 'unrestricted')
     AND excluded_by_criterion_id IS NOT NULL AND limiting_criterion_id IS NULL AND score IS NULL)
  OR
  (verdict IN ('suitable', 'unsuitable') AND excluded_by_criterion_id IS NULL AND score IS NOT NULL)
);

-- How many Prüfhinweise the cell carries for this technology, counted at
-- materialisation by lib/scoring/protection-flags.ts — the one place the rule
-- lives — so the map can mark flagged cells without restating the rule in SQL.
-- NULL where the rule does not apply (wind, the fixture).
ALTER TABLE suitability_verdict ADD COLUMN protection_flag_count integer
  CHECK (protection_flag_count IS NULL OR protection_flag_count >= 0);

COMMENT ON TABLE suitability_verdict IS
  'ADR-0004, ADR-0009: classified verdicts (excluded, not_considered, restricted, unrestricted) name the '
  'criterion that decided them (excluded_by_criterion_id) and carry no score; suitable/unsuitable '
  '(the illustrative fixture only) carry a score and name a limiting criterion where one stands out.';
