# ADR-0001 — Spatial unit: generated hex grid, not ALKIS *Flurstück*

**Status:** Accepted · **Band:** `0.2.0` · **Date:** 2026-08-22 · **Closes:** U1 (`docs/product/mvp.md` §9)

---

## Context

Every criterion, outcome, and score in sela attaches to a spatial unit. `docs/product/mvp.md`
§8.1 named this the decision with the widest downstream effect: on licensing cost, on data
joins, and on whether results are addressable the way a municipality expects.

Two candidates were on the table:

- **ALKIS *Flurstück*** (the cadastral parcel) — the unit a municipality actually names in a
  council session, and the unit a landowner recognises as "their" land.
- **A generated grid** — cells with no cadastral meaning, produced entirely from public
  geometry.

ALKIS access in Germany is administered per-*Bundesland*, is frequently fee-based, and in most
states requires a data-sharing agreement before any parcel geometry can be ingested — let alone
redistributed in a derived score. Pursuing it first would put procurement and licence negotiation
on the critical path before a single scenario could be computed, and `docs/architecture/roadmap-to-first-deployment.md`
already commits to "real pilot-region data from the start."

## Decision

**The spatial unit for `0.2.x`–`0.3.x` is a generated 100 m hexagonal grid**, produced with
PostGIS `ST_HexagonGrid` and clipped to the pilot region's boundary polygon. Hex cells are used
instead of a square grid because they have a single, consistent adjacency (no shared-corner
ambiguity), which keeps connectivity-based nature-capital indicators (U2) well-defined.

This is implemented behind a `spatial_unit` abstraction: every unit row carries a `kind` column
(e.g. `hex_grid`, and later `flurstueck`). Nothing above the storage layer — scoring, API
responses, UI — is permitted to assume the unit is a hex cell. Adding *Flurstück* support later
is therefore a new row type and a join, not a schema rewrite or a rewrite of the scoring
functions in `lib/scoring/`.

Cell size (100 m) is a pilot-region configuration value, not a hard constant, and may be revisited
once real criterion resolution (e.g. 1 km DWD radiation grids vs. finer land-cover data) is
known in Phase 2.

## Consequences

**Gained:**
- No ALKIS procurement or per-*Bundesland* licensing negotiation blocks Phase 2. The pilot can
  start from open geometry (the pilot boundary polygon) alone.
- Every cell is addressable and scoreable from day one, with no cadastral gaps or slivers.
- The `kind` abstraction means *Flurstück* is additive, preserving the investment in scoring and
  UI code once ALKIS access is later secured for a given *Bundesland*.

**Given up, and not hidden:**
- **A grid cell is not what a municipality names in a council session** (`docs/product/mvp.md`
  §2). A planning officer will ask "which *Flurstück* is this" before "which cell is this," and
  v0.1–v0.3 cannot answer that directly. This is a known credibility gap for the municipality
  user group until *Flurstück* support lands.
- A hex cell can straddle a real parcel boundary, mixing land uses (and licences) that a
  cadastral unit would keep separate. Criterion values sampled per cell are therefore an
  area-weighted approximation, not an exact per-parcel figure — this must be stated wherever a
  cell-level number is shown (`docs/product/design-language.md` §8, no false precision).
- Comparisons across pilot regions with different cell alignments are not directly poolable
  without re-aggregation.

**Follow-on work this creates:** the `spatial_unit` schema and the hex-generation step are Phase 2
(`0.2.1`) deliverables per `docs/architecture/roadmap-to-first-deployment.md` §4.1–4.2. This ADR
fixes the *choice*; it does not implement the table.
