-- ADR-0008: outcomes carry their provenance, their measure, and "does not apply".
--
-- Until now every real preserve/restore outcome was not_modelled, so the
-- outcome table never had to explain a number. The first real methods
-- (docs/domain/scoring-criteria.md §4: peat climate, water balance) need four
-- things this table lacked: a measure within a dimension (climate is two
-- measures, stock and annual balance, in every scenario), a range (grassland on
-- peat, drainage depth unknown), a third status (no peat here is not the same
-- as "not yet modelled"), and a link from each number to the criterion values
-- and the cited method that produced it.

-- 1. metric — one unit per metric, in every scenario. Existing rows keep their
--    meaning: one measure, named after its dimension.
ALTER TABLE outcome ADD COLUMN metric text;
UPDATE outcome SET metric = dimension;
ALTER TABLE outcome ALTER COLUMN metric SET NOT NULL;

ALTER TABLE outcome DROP CONSTRAINT outcome_spatial_unit_id_scenario_dimension_method_version_key;
ALTER TABLE outcome
  ADD CONSTRAINT outcome_unit_scenario_dimension_metric_method_key
  UNIQUE (spatial_unit_id, scenario, dimension, metric, method_version);

-- 2. range — when set, the interface shows the range, never the central value alone.
ALTER TABLE outcome ADD COLUMN value_low double precision;
ALTER TABLE outcome ADD COLUMN value_high double precision;
ALTER TABLE outcome ADD CONSTRAINT outcome_range_paired CHECK ((value_low IS NULL) = (value_high IS NULL));
ALTER TABLE outcome ADD CONSTRAINT outcome_range_contains_value
  CHECK (value_low IS NULL OR (value_low <= value AND value <= value_high));

-- 3. not_applicable — the method covers this cell and finds nothing to measure.
--    Like not_modelled it carries no value; unlike it, it is a claim about the land.
ALTER TABLE outcome DROP CONSTRAINT outcome_status_check;
ALTER TABLE outcome ADD CONSTRAINT outcome_status_check
  CHECK (status IN ('modelled', 'not_modelled', 'not_applicable'));
ALTER TABLE outcome DROP CONSTRAINT outcome_check;
ALTER TABLE outcome ADD CONSTRAINT outcome_value_matches_status CHECK (
  (status = 'modelled' AND value IS NOT NULL AND confidence IS NOT NULL)
  OR (status <> 'modelled' AND value IS NULL AND value_low IS NULL)
);

-- 4. provenance — the cited method, and the criterion values each outcome read.
CREATE TABLE outcome_method (
  method_version  text PRIMARY KEY,
  dimension       text NOT NULL CHECK (
    dimension IN ('energy', 'climate', 'nature_capital', 'soil_water', 'land_use', 'local_benefit')
  ),
  name_de         text NOT NULL,
  name_en         text NOT NULL,
  citation        text NOT NULL CHECK (btrim(citation) <> ''),
  parameters      jsonb NOT NULL,
  description_de  text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outcome_method IS
  'The named, versioned, cited method behind a set of outcome rows (ADR-0008). parameters holds '
  'every factor the method uses, each with its own citation — the table the method page prints.';

CREATE TABLE outcome_input (
  outcome_id          bigint NOT NULL REFERENCES outcome (id) ON DELETE CASCADE,
  criterion_value_id  bigint NOT NULL REFERENCES criterion_value (id) ON DELETE CASCADE,
  PRIMARY KEY (outcome_id, criterion_value_id)
);

CREATE INDEX outcome_input_criterion_value_idx ON outcome_input (criterion_value_id);

COMMENT ON TABLE outcome_input IS
  'Which criterion values an outcome was computed from (ADR-0008). With criterion_value.source_id '
  'NOT NULL, every modelled outcome reaches a source and licence in two joins.';
