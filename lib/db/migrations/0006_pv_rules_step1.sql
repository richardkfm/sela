-- Roadmap Step 1 (docs/product/roadmap-pilot-demo.md): the four placeholder
-- scoring rules, decided by the project owner on 2026-09-27
-- (docs/domain/decision-memo-scoring-rules.md, ADR-0009). Three schema needs:
--
-- 1. A fourth verdict, `not_considered` ("nicht vorgesehen"): the land-cover
--    tier left the score and became a category (memo, *Follow-up decisions*).
--    A cell whose dominant CLC class is *nicht vorgesehen* gets no score; like an
--    exclusion it names the criterion that decided it — in
--    excluded_by_criterion_id, which for this state reads "decided by". It is
--    kept apart from `excluded` because an exclusion cites a statute, and this
--    is sela's own classification.
-- 2. A scored verdict may name no limiting criterion (Q5): one is named only
--    when a criterion falls at least a stated gap below the best value in the
--    compared land.
-- 3. protection_overlap: every protected area a cell overlaps, by name, with
--    its share — the evidence behind the new *Prüfhinweise* (memo Q1c, Q2d).

-- 1 + 2. Verdict states.
ALTER TABLE suitability_verdict DROP CONSTRAINT suitability_verdict_verdict_check;
ALTER TABLE suitability_verdict DROP CONSTRAINT suitability_verdict_check;
ALTER TABLE suitability_verdict ADD CONSTRAINT suitability_verdict_verdict_check
  CHECK (verdict IN ('suitable', 'unsuitable', 'excluded', 'not_considered'));
ALTER TABLE suitability_verdict ADD CONSTRAINT suitability_verdict_state_check CHECK (
  (verdict IN ('excluded', 'not_considered')
     AND excluded_by_criterion_id IS NOT NULL AND limiting_criterion_id IS NULL AND score IS NULL)
  OR
  (verdict IN ('suitable', 'unsuitable') AND excluded_by_criterion_id IS NULL AND score IS NOT NULL)
);

COMMENT ON TABLE suitability_verdict IS
  'ADR-0004, ADR-0009: excluded and not_considered verdicts name the criterion that decided them '
  '(excluded_by_criterion_id) and carry no score; suitable/unsuitable verdicts carry a score and name '
  'their limiting criterion only where one falls clearly below the best value in the compared land (flow F2).';

-- A category criterion (ADR-0009) sorts cells into named classes and never
-- enters the weighted score; it can make a cell `not_considered`.
ALTER TABLE criterion_definition ADD COLUMN is_category boolean NOT NULL DEFAULT false;
ALTER TABLE criterion_definition ADD CONSTRAINT criterion_definition_role_check
  CHECK (NOT (is_category AND is_hard_constraint));

-- 3. Protected-area overlaps. One row per cell and area; the share is the
--    cell's area inside that area. Every overlap is stored — which overlaps
--    become a Prüfhinweis (≥ 1 % of the cell, by category) is a rule in
--    lib/scoring/protection-flags.ts, not a property of the data.
CREATE TABLE protection_overlap (
  spatial_unit_id  uuid NOT NULL REFERENCES spatial_unit (id),
  category         text NOT NULL CHECK (category IN ('nsg', 'natp', 'ffh', 'spa', 'lsg', 'br')),
  area_code        text NOT NULL,
  name             text NOT NULL,
  share            double precision NOT NULL CHECK (share > 0 AND share <= 1),
  source_id        text NOT NULL REFERENCES source (id),
  computed_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (spatial_unit_id, category, area_code, name)
);

COMMENT ON TABLE protection_overlap IS
  'Each protected area a spatial unit overlaps, from the LfU overview data (digitised at 1:10 000, '
  'not legally binding). Evidence for the Prüfhinweise; ADR-0009.';
