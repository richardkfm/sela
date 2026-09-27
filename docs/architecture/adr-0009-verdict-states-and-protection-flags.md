# ADR-0009 — A "not considered" verdict, an optional limiting criterion, and named protection overlaps

**Status:** Accepted · **Band:** `0.3.x` · **Date:** 2026-09-27 · **Amends:** `suitability_verdict`
and `criterion_definition` in `lib/db/migrations/0002_domain_schema.sql`, via
`0006_pv_rules_step1.sql`

---

## Context

Roadmap Step 1 (`docs/product/roadmap-pilot-demo.md`) implements the scoring rules the project
owner decided on 2026-09-27 (`docs/domain/decision-memo-scoring-rules.md`, Q1–Q5 and
*Follow-up decisions*). Three of those decisions do not fit the schema of `0002`:

1. **Land cover is a category, not a score** (follow-up to Q3b). Its three tiers stop moving the
   weighted score. Measured on the Uckermark, that alone would turn **26 930** forest, water,
   settlement and wetland cells *geeignet*, so the owner decided that a cell whose dominant class
   is *nicht vorgesehen* receives **its own state, with no score**. `suitability_verdict` knows
   only `suitable`, `unsuitable` and `excluded`.
2. **A limiting criterion is not always named** (Q5). The owner decided that one is named only
   when it lies at least 0.1 below the best value of that criterion in the compared land.
   `0002` requires every scored verdict to name one.
3. **Protected areas that do not exclude are named** (Q1c, Q2d): FFH, SPA and LSG areas, and a
   Naturschutzgebiet covering less than half a cell, appear as *Prüfhinweise* with the area's
   name and share. Until now only the NSG/Nationalpark union share per cell was stored.

## Decision

1. **A fourth verdict, `not_considered`** (German label *nicht vorgesehen*). It carries no score
   and no limiting criterion; like `excluded`, it names the criterion that decided it in
   `excluded_by_criterion_id` (for this state read as "decided by"). It is **not** folded into
   `excluded`: an exclusion cites a statute, this state cites sela's own classification, and the
   map and legend keep them apart (`docs/product/design-language.md` §4.2a).
2. **Category criteria.** `criterion_definition.is_category` marks a criterion that sorts cells
   into named classes and never enters the score; `pv_land_cover` is the first. It cannot also be
   a hard constraint. The engine checks, in this order: hard constraints (a statute outranks a
   classification), categories, then the weighted score (`lib/scoring/suitability.ts`).
3. **`limiting_criterion_id` may be null on a scored verdict.** The Q5 rule is a parameter of
   the pure engine (`limitingReference`); the materialiser computes the reference — the best
   normalised value per criterion among the units scored for the same technology in the region —
   in a first pass. Without a reference the engine keeps its old behaviour (gap to a perfect 1,
   always one criterion named), which the tests pin.
4. **`protection_overlap`**: one row per cell and protected area, with category, *Gebietsnummer*,
   name and share, from the LfU overview data. Every overlap is stored, however small; **which
   overlaps become a Prüfhinweis is code** (`lib/scoring/protection-flags.ts`: ≥ 1 % of the cell;
   NSG/Nationalpark only while the cell is not excluded; Biosphärenreservat not shown), so a rule
   change does not need a re-ingest. Written by `ingest/real/22_protection_overlap.sql`.
5. **The decided rules live in one module**, `lib/scoring/pv-rules.ts`, which both the engine and
   the method page read, so the published rules cannot drift from the running ones.

## Consequences

- Verdicts are materialised under method version `0.3.1-dev`; criterion definitions carry
  `illustrative-real-v1`. The weights, slope bounds and threshold are still placeholders, so the
  *ILLUSTRATIV* banner stays.
- Every screen that reads a verdict must handle the fourth state and a missing limiting
  criterion: parcel page, map panel, legend, 3D preview, scenario card. The card, which must cite
  what its headline rests on, cites every scored criterion when none is named as limiting.
- `protection_overlap` is region data, not method output; it has no `method_version`.
- The map gains a fifth class. Its colour sits between *ungeeignet* and *ausgeschlossen* in
  lightness, with a stipple no other map class uses.

## Alternatives considered

- **Count *nicht vorgesehen* as `excluded`** — simpler, one map class fewer, but it makes sela's
  classification look like a statute. Rejected by the owner.
- **Show *nicht vorgesehen* only as a note beside a *geeignet* verdict** — would put
  "geeignet" on 26 930 forest and water cells. Rejected.
- **Store only a share per category** (no names) — no new table, but "ein FFH-Gebiet" instead of
  the area's name and code. Rejected by the owner in favour of named, citable areas.
