# ADR-0008 — Outcomes carry their provenance, their measure, and "does not apply"

**Status:** Accepted · **Band:** `0.3.x` · **Date:** 2026-09-24 · **Amends:** the `outcome` table of
`lib/db/migrations/0002_domain_schema.sql` (roadmap §4.1)

---

## Context

Until now every real `preserve` and `restore` outcome was `not_modelled` (U2), so the `outcome`
table never had to explain a number. That changes with the first real nature-capital method
(`docs/domain/scoring-criteria.md` §4): peatland climate and water balance for the Uckermark.
Three gaps in the table would make those numbers unpublishable under `CLAUDE.md` §4.1:

1. **No provenance.** `outcome` stores value, unit and confidence, but no link to the criterion
   values or the method that produced them. A `suitability_verdict` names its limiting criterion;
   an outcome names nothing. A reader could not get from an emission figure to the peat map and the
   IPCC table behind it.
2. **One value per dimension.** The owner decided on 2026-09-24 that `preserve` shows the carbon
   stock that stays in the ground, and that climate is shown as **two measures in every scenario**,
   stock (t C/ha) and annual greenhouse-gas balance (t CO₂-Äq./ha·a). `UNIQUE (spatial_unit_id,
   scenario, dimension, method_version)` allows one. Worse, `computeOutcomeDelta` subtracts the
   baseline without checking units, so a stock minus a flux would reach the screen as a number.
3. **Two kinds of "empty".** A cell with no peat has no peat emissions to rewet away. Showing
   *noch nicht modelliert* there says "we don't know yet" when the truth is "this does not apply
   here". The owner decided (2026-09-24) that these are different states.

A fourth need follows from the owner's choice to **show a range** where the evidence gives one
(grassland on peat, whose drainage depth no open dataset records): the row must hold the span,
not only a central value.

Schema changes are architecture under `CLAUDE.md` §3. All four were confirmed by the project owner
on 2026-09-24.

## Decision

Migration `0005_outcome_provenance.sql`:

### 1. A measure within a dimension — `outcome.metric`

`metric text NOT NULL`, part of the unique key: `UNIQUE (spatial_unit_id, scenario, dimension,
metric, method_version)`. Existing rows get `metric = dimension` (one measure, named after its
dimension), so nothing already stored changes meaning.

The rule that keeps the comparison honest: **a metric has one unit, in every scenario.** Every
scenario of a dimension reports the same set of metrics (`mvp.md` §5: "the same outcome
dimensions"), and deltas are computed per metric. `computeOutcomeDelta` gains a guard: it refuses
to subtract rows with different `metric` or `unit` rather than trusting callers.

### 2. A range — `outcome.value_low`, `outcome.value_high`

Both nullable; `CHECK (value_low IS NULL) = (value_high IS NULL)` and
`CHECK (value_low <= value AND value <= value_high)`. When set, **the interface shows the range,
never the central value alone** (`CLAUDE.md` §4.5). What the range means is stated per method on
the method page: a published confidence interval, or a span between two published factors.

### 3. A third status — `not_applicable`

`status ∈ ('modelled', 'not_modelled', 'not_applicable')`. `not_applicable` requires `value IS
NULL`, like `not_modelled`, and is rendered as ***trifft nicht zu*** with a one-line reason from
the method (e.g. *"kein Moorboden in dieser Zelle"*). It is never rendered as zero. A delta
involving it is `null`, as for `not_modelled`.

The distinction is a claim sela must be able to defend: `not_applicable` says the method *does*
cover this cell and finds nothing to measure; `not_modelled` says the method does not cover it.

### 4. Provenance — `outcome_method` and `outcome_input`

```
outcome_method (
  method_version  text PRIMARY KEY,   -- e.g. 'peat-climate-ipcc2013-v1'
  dimension       text NOT NULL,
  name_de, name_en text NOT NULL,
  citation        text NOT NULL,      -- the established method, with table and page
  parameters      jsonb NOT NULL,     -- every factor used, with its own citation
  description_de  text NOT NULL       -- what the number means, for the method page
)

outcome_input (
  outcome_id         bigint REFERENCES outcome (id) ON DELETE CASCADE,
  criterion_value_id bigint REFERENCES criterion_value (id),
  PRIMARY KEY (outcome_id, criterion_value_id)
)
```

`outcome.method_version` gains a foreign key to `outcome_method` for rows written from this
migration on. Because `criterion_value.source_id` is already `NOT NULL`, every modelled outcome
now reaches a source and a licence in two joins: outcome → input → criterion value → source.

**The enforced rule:** a `modelled` outcome under a registered method must have at least one
`outcome_input` row. This is checked by the materialisation step and by a test, not by a
database constraint (a deferred trigger for one rule is more machinery than it earns).

The coefficient table lives in `parameters`, not in code. It is the value the method page prints,
and the one a reviewer would challenge.

## Consequences

- The comparison screen and the export card group outcomes by dimension, then by metric. Two climate
  rows per scenario is the intended result, not clutter.
- `lib/scoring/types.ts` gains `metric`, `valueLow`, `valueHigh` and the third status; the
  `OutcomeStatus` union change is caught by the type checker in every renderer.
- Fixture and illustrative outcomes keep working: they get `metric = dimension` and no method row.
  Their method version (`illustrative-*`) is labelled illustrative as before.
- **Not decided here:** how `develop_*` scenarios report climate on peat (a PV array on a drained
  fen), which stays `not_modelled`. It is a scoring question for a later gate.

## Alternatives not taken

- **Split climate into two dimensions** (`climate_stock`, `climate_flux`). Rejected: the six
  dimensions in `mvp.md` §8.3 are the product's vocabulary, and adding one is a scope change. A
  measure *within* a dimension is not.
- **Provenance as JSON on the outcome row.** Rejected: it would duplicate `criterion_value` and let
  the two drift. A join table cannot disagree with the values it points to.
