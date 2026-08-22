-- Phase 2 (0.2.1): the domain schema. Per
-- docs/architecture/roadmap-to-first-deployment.md §4.1, this is where the
-- product principles in CLAUDE.md become constraints the database enforces
-- rather than rules that rely on discipline elsewhere in the stack.
--
-- Storage CRS is EPSG:25832 (ETRS89 / UTM 32N) for metric operations
-- (ADR-0001, roadmap §4.1); reprojection to EPSG:4326/3857 happens at the
-- serving edge, not here.

-- ---------------------------------------------------------------------------
-- source: every criterion and every criterion value traces to exactly one of
-- these. `redistributable` is not nullable and defaults to false: a source
-- enters this table possibly before its redistribution question is answered,
-- but it may not silently read as "yes" until someone sets it explicitly
-- (docs/data/sources.md is the record of that decision, not this default).
-- ---------------------------------------------------------------------------
CREATE TABLE source (
  id             text PRIMARY KEY,
  dataset        text NOT NULL,
  publisher      text NOT NULL,
  version        text,
  retrieved_at   date,
  licence        text NOT NULL,
  redistributable boolean NOT NULL DEFAULT false,
  url            text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE source IS
  'A cited dataset (mvp.md §8.2, glossary "Source"). redistributable records '
  'whether derived/aggregated outputs may be published, not just the raw data '
  '(U7) — see docs/data/sources.md for the verification behind each row.';

-- ---------------------------------------------------------------------------
-- spatial_unit: the atomic area everything else attaches to. `kind` is the
-- ADR-0001 abstraction — hex_grid for 0.2.x-0.3.x, flurstueck later without a
-- schema rewrite.
-- ---------------------------------------------------------------------------
CREATE TABLE spatial_unit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('hex_grid', 'flurstueck')),
  pilot_region  text NOT NULL,
  geom          geometry(Polygon, 25832) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spatial_unit_geom_idx ON spatial_unit USING gist (geom);
CREATE INDEX spatial_unit_pilot_region_idx ON spatial_unit (pilot_region);

COMMENT ON TABLE spatial_unit IS
  'The unit every criterion, outcome, and score attaches to (ADR-0001). '
  'kind keeps the concrete unit type swappable without touching scoring or API code.';

-- ---------------------------------------------------------------------------
-- criterion_definition: the catalogue entry. Real rows (with real weights)
-- are scoring-gate work under CLAUDE.md §3, written once
-- docs/domain/scoring-criteria.md's weights are confirmed — this table only
-- fixes the shape.
-- ---------------------------------------------------------------------------
CREATE TABLE criterion_definition (
  id                 text PRIMARY KEY,
  name_en            text NOT NULL,
  name_de            text NOT NULL,
  source_id          text NOT NULL REFERENCES source (id),
  direction          text NOT NULL CHECK (direction IN ('higher_better', 'lower_better', 'non_monotonic')),
  weight             numeric NOT NULL CHECK (weight >= 0),
  is_hard_constraint boolean NOT NULL DEFAULT false,
  applies_to         text[] NOT NULL,
  unit               text,
  method_version     text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX criterion_definition_applies_to_idx ON criterion_definition USING gin (applies_to);

COMMENT ON TABLE criterion_definition IS
  'The atomic unit of explanation (mvp.md §8.2). is_hard_constraint marks the '
  'ADR-0004 filter path; every other criterion composes into a weighted score.';
COMMENT ON COLUMN criterion_definition.applies_to IS
  'Which technologies/scenarios this criterion participates in, e.g. {develop_pv, develop_agripv}.';

-- ---------------------------------------------------------------------------
-- criterion_value: the measured value for one spatial unit. source_id is
-- NOT NULL by design (roadmap §4.1) — this is the rule made unviolatable:
-- a criterion without a source and licence does not enter a score
-- (mvp.md §8.2).
-- ---------------------------------------------------------------------------
CREATE TABLE criterion_value (
  id               bigserial PRIMARY KEY,
  spatial_unit_id  uuid NOT NULL REFERENCES spatial_unit (id),
  criterion_id     text NOT NULL REFERENCES criterion_definition (id),
  source_id        text NOT NULL REFERENCES source (id),
  value            double precision NOT NULL,
  unit             text,
  confidence       text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  method_version   text NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spatial_unit_id, criterion_id, method_version)
);

CREATE INDEX criterion_value_spatial_unit_idx ON criterion_value (spatial_unit_id);
CREATE INDEX criterion_value_criterion_idx ON criterion_value (criterion_id);

COMMENT ON TABLE criterion_value IS
  'source_id NOT NULL is the enforced rule from roadmap §4.1: '
  'a criterion without a source and licence does not enter a score.';

-- ---------------------------------------------------------------------------
-- outcome: the shared axes scenarios are compared on (mvp.md §8.3). status
-- makes "not yet modelled" a first-class state — never zero, never a
-- silently omitted row.
-- ---------------------------------------------------------------------------
CREATE TABLE outcome (
  id               bigserial PRIMARY KEY,
  spatial_unit_id  uuid NOT NULL REFERENCES spatial_unit (id),
  scenario         text NOT NULL CHECK (
    scenario IN ('status_quo', 'develop_pv', 'develop_agripv', 'develop_wind', 'preserve', 'restore')
  ),
  dimension        text NOT NULL CHECK (
    dimension IN ('energy', 'climate', 'nature_capital', 'soil_water', 'land_use', 'local_benefit')
  ),
  value            double precision,
  unit             text,
  confidence       text CHECK (confidence IN ('high', 'medium', 'low')),
  status           text NOT NULL DEFAULT 'modelled' CHECK (status IN ('modelled', 'not_modelled')),
  method_version   text NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spatial_unit_id, scenario, dimension, method_version),
  CHECK (status = 'not_modelled' OR (value IS NOT NULL AND confidence IS NOT NULL))
);

CREATE INDEX outcome_spatial_unit_idx ON outcome (spatial_unit_id);

COMMENT ON TABLE outcome IS
  'status ∈ (modelled, not_modelled) makes "not yet modelled" a real state '
  '(mvp.md §8.3, design-language.md §8), never a missing row or a zero.';

-- ---------------------------------------------------------------------------
-- suitability_verdict: flow F2 — per technology, a verdict with its single
-- limiting criterion, or an exclusion naming its constraint (ADR-0004).
-- ---------------------------------------------------------------------------
CREATE TABLE suitability_verdict (
  id                        bigserial PRIMARY KEY,
  spatial_unit_id           uuid NOT NULL REFERENCES spatial_unit (id),
  technology                text NOT NULL CHECK (technology IN ('pv', 'agripv', 'wind')),
  verdict                   text NOT NULL CHECK (verdict IN ('suitable', 'unsuitable', 'excluded')),
  score                     double precision,
  limiting_criterion_id     text REFERENCES criterion_definition (id),
  excluded_by_criterion_id  text REFERENCES criterion_definition (id),
  method_version            text NOT NULL,
  computed_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spatial_unit_id, technology, method_version),
  CHECK (
    (verdict = 'excluded' AND excluded_by_criterion_id IS NOT NULL AND limiting_criterion_id IS NULL AND score IS NULL)
    OR
    (verdict IN ('suitable', 'unsuitable') AND limiting_criterion_id IS NOT NULL AND excluded_by_criterion_id IS NULL AND score IS NOT NULL)
  )
);

CREATE INDEX suitability_verdict_spatial_unit_idx ON suitability_verdict (spatial_unit_id);

COMMENT ON TABLE suitability_verdict IS
  'ADR-0004: excluded verdicts name their constraint and carry no score; '
  'suitable/unsuitable verdicts always name their single limiting criterion (flow F2).';
