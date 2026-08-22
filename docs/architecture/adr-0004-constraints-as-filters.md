# ADR-0004 — Hard constraints act as filters, not scored penalties

**Status:** Accepted · **Band:** `0.2.1` · **Date:** 2026-08-22 · **Closes:** U4 (`docs/product/mvp.md` §9, §8.4)

---

## Context

`docs/product/mvp.md` §8.4 distinguishes two kinds of suitability input: factors that merely
reduce suitability, and factors that exclude a technology outright — statutory protection status
(*Naturschutzgebiet*, *Landschaftsschutzgebiet*), statutory setback distances, and similar
regulatory constraints. Whether the second kind is modelled as a hard filter or folded into the
weighted score as a heavy penalty was left open as U4, flagged as changing both the interface and
sela's legal exposure.

`docs/architecture/roadmap-to-first-deployment.md` §4.3 carried a recommendation into Phase 2 —
filter, with the reason surfaced — and assigned closing this decision to this band, once the
`criterion_definition` / `suitability_verdict` schema (§4.1) existed to reason about concretely.
This ADR closes it.

## Decision

**A criterion flagged as a hard constraint (`criterion_definition.is_hard_constraint = true`)
that is violated removes a technology from consideration entirely.** It does not lower a score —
the suitability verdict for that spatial unit and technology becomes `excluded`, naming the
specific constraint that excluded it (`suitability_verdict.excluded_by_criterion_id`). An excluded
verdict carries no numeric score at all; there is nothing to average the exclusion into.

Non-constraint criteria continue to compose into a weighted suitability score as before, with the
single most limiting one surfaced per flow F2.

**Reasoning:**

- **A low score invites arguing the weight; an exclusion states the law.** Folding a
  *Naturschutzgebiet* into a penalty implies that enough favourable irradiation or grid proximity
  could outweigh a legal prohibition. It cannot, and a scoring system that implies otherwise is
  giving investors and municipalities a false negotiating surface — exactly the "optimism about
  parcels with obvious legal or acceptance barriers" `mvp.md` §2 names as what makes an investor
  dismiss the tool.
- **It matches how the constraint actually behaves in law.** A statutory setback or protection
  status is a binary eligibility gate, not a continuous cost. Modelling it as anything else asserts
  a trade-off that does not exist.
- **It is more legally defensible to publish.** "Excluded because inside a *Naturschutzgebiet*" is
  a factual, checkable statement. "Scored 12/100, partly due to protection status" invites a
  challenge sela cannot win, because it implies a judgement about how much the protection *should*
  count — sela does not recommend (`CLAUDE.md` §4.5) and must not smuggle a recommendation in
  through a weight.

## Consequences

**Gained:**
- The interface has one unambiguous state to design for exclusion (`design-language.md`'s
  "not yet modelled" precedent already establishes that a status is not a number — `excluded`
  follows the same pattern) rather than a score that needs a footnote explaining it isn't really
  comparable to other scores.
- Legal exposure is reduced: sela states which named constraint applies, sourced back to its
  `criterion_definition` and `source` row, rather than implying a weighing sela performed.

**Given up, and not hidden:**
- **A cell one metre outside a boundary and a cell in the middle of a protected area are
  indistinguishable** under this rule — both are simply `excluded`. Proximity to a hard boundary
  is real information (relevant to "would a boundary redraw change this") that a pure filter
  discards. This is an accepted loss for `0.2.1`; if it matters later, it is a `criterion_value` on
  distance-to-boundary shown *alongside* the exclusion, not a change to how exclusion itself works.
- **A cell excluded on a weak, low-confidence constraint dataset is still fully excluded** — there
  is no partial-confidence exclusion in this model. Confidence is still recorded and shown on the
  constraint criterion itself, so a user can see the exclusion rests on lower-confidence data, but
  the verdict does not soften proportionally. Getting this wrong in the source data is a data-
  quality bug to fix at the source, not something the scoring model should compensate for by
  degrees.
- **Which criteria count as hard constraints is itself a decision this ADR does not make.** Per-
  criterion, `is_hard_constraint` is set when each `criterion_definition` row is written
  (`docs/domain/scoring-criteria.md`), and that determination is scoring-gate work under
  `CLAUDE.md` §3, not an architectural one.

**Implementation, fixed by this ADR (`lib/db/migrations/0002_domain_schema.sql`,
`lib/scoring/suitability.ts`):**
- `criterion_definition.is_hard_constraint boolean not null default false`.
- `suitability_verdict.verdict` is one of `suitable`, `unsuitable`, `excluded`.
- `excluded_by_criterion_id` is set if and only if `verdict = 'excluded'`; `limiting_criterion_id`
  is set if and only if `verdict` is `suitable` or `unsuitable`. A verdict is never both.
- Scoring evaluates every hard-constraint criterion for a technology *before* computing a weighted
  score. The first violated hard constraint (or, deterministically, the one with the largest
  weight if several are violated) is recorded as `excluded_by_criterion_id`, and no score is
  computed. Only if no hard constraint is violated does the weighted-score path run.
