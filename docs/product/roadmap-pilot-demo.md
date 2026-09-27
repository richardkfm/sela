# Roadmap — from illustrative scoring to a credible pilot demo

**Version band:** `0.3.x` · **Status:** proposed — milestone chosen by the project owner
2026-09-27; every step marked *gated* still needs its own `CLAUDE.md` §3 confirmation ·
**Last updated:** 2026-09-27

This document plans the next milestone after `docs/architecture/roadmap-to-first-deployment.md`,
whose three phases are built. It refines `docs/product/mvp.md`; it does not widen it.

---

## 1. Where sela stands (2026-09-27)

A real 100 m cell in the Landkreis Uckermark can be selected, its *develop* verdict traced to real,
cited criterion values, and its *preserve*/*restore* climate and water outcomes traced to cited
methods (ADR-0008). Five screens, the 3D preview and the scenario-card export work. What stops a
screenshot of it from being shown to a planning office as anything more than a mechanism demo:

| Gap | Where it is recorded | Effect on screen today |
|---|---|---|
| Every weight, bound, land-cover score and threshold is a placeholder | `scoring-criteria.md` §6 | *ILLUSTRATIV* banner on every verdict |
| Four placeholder rules awaiting a decision | `scoring-criteria.md` §6, `CHANGELOG.md` *Open* | Irradiation is "limiting" almost everywhere — an artefact of the bounds |
| No energy outcome | `scoring-criteria.md` §4 | *develop* shows what it costs, never what it gains — the second of sela's four questions goes unanswered |
| Wind never scored; agri-PV identical to PV | `scoring-criteria.md` §2–3, §6 | Two of three technologies are placeholders |
| Habitat not shown | `scoring-criteria.md` §4.3 | *nature capital* is *noch nicht modelliert* on every cell |
| No search, no multi-cell selection | `mvp.md` F1, F6 | A council member cannot find "their" land; a hex cell is not what a council names (ADR-0001) |
| No CI; ingest image never built; nothing hosted | `CHANGELOG.md` *Open* | The demo exists only on a developer machine |

## 2. The milestone

> **A credible pilot demo:** for ground-mounted PV in the Uckermark, every number on the parcel,
> comparison and evidence screens is either backed by a *confirmed* method or visibly
> *noch nicht modelliert* / *nicht bewertet* — and no *ILLUSTRATIV* banner remains on the PV path.

Deliberately **not** in this milestone:

- **User validation.** Deferred by the project owner (2026-09-27). The `mvp.md` §10 v0.3 criterion
  "at least one municipality has used it" stays open and is not claimed by this milestone.
- **Public launch** (`1.0.0`): U5, U6, U9, U10 stay open.
- **Wind and agri-PV scoring.** They stay honestly *nicht bewertet* / "equals PV" on screen unless
  a sourced criterion arrives; §4 lists the research that could change that.

PV first because it is the only technology whose criteria already have confirmed, ingested
sources (`scoring-criteria.md` §2).

## 3. Steps, in order

Each step names its gate. *Gated* means: proposal first, implementation only after explicit
confirmation (`CLAUDE.md` §3).

### Step 1 — Decide the four pending placeholder rules · gated (scoring, scope)

The protection-area categories that exclude, the "half the cell" line, the land-cover score
table, and the irradiation bounds. They come first because Step 2's weights are meaningless while
the normalisation underneath them is still a placeholder.

**Deliverable:** a decision memo with measured effects per option and a recommendation for each —
`docs/domain/decision-memo-scoring-rules.md` (written 2026-09-27, measured on a local rebuild of
the Uckermark pipeline; awaiting the owner's decisions). It adds a fifth question — how flow F2
names the limiting criterion — because the measurements show that, not the bounds, is what makes
irradiation "limiting" almost everywhere. The decisions, once taken, are
recorded in `scoring-criteria.md` §6 and implemented as a new `method_version`, never as an edit
of `illustrative-real-v0`.

### Step 2 — First confirmed PV method (`real-pv-v1`) · gated (scoring)

Weights for the PV criteria that have sources (`pv_irradiation_annual`, `pv_land_cover`,
`pv_slope`), the verdict threshold, and — to be asked, not assumed — whether a binary
*geeignet/ungeeignet* threshold is the right presentation at all, or whether the score is shown
with its decomposition only. Each weight carries a written rationale in `scoring-criteria.md` §2.
Output: a seed migration, the banner removed for the PV path only, method page updated from the
same rows.

### Step 3 — Energy outcome under `develop_pv` · gated (scoring, data)

Answers "what is gained": annual yield per cell from the ingested irradiation, through a **cited**
specific-yield method and a **cited** land-use density for ground-mounted PV. Neither citation is
chosen yet — the step starts with sourcing them, and ships as `not_modelled` if no citable method
survives review (`CLAUDE.md` §4.3 applies to energy too). Follows ADR-0008's provenance pattern.

### Step 4 — Habitat as categories · gated (data)

The LfU *Biotopkataster* view already scoped in `scoring-criteria.md` §4.3: protected biotope yes/no,
FFH *Lebensraumtyp* and conservation status — facts, not a score. Blocked first on clarifying the
INSPIRE Art. 13(1)(e) restriction note with LfU (`sources.md` §8).

### Step 5 — Finding and grouping land · gated (user-visible behaviour)

- **F1 search** by *Gemeinde* and coordinates. The *Gemeinde* boundaries would come from the
  already-confirmed VG25 archive (whether its fetched version carries the municipality layer is
  to be checked, not assumed). Address search needs a geocoder — a new data source, separately gated.
- **Multi-cell selection** (a drawn or clicked group of cells, summarised as one "site"), which is
  the practical answer to ADR-0001's admitted gap until *Flurstück* geometry is affordable.
- **F6** parcel-vs-parcel comparison and the printable comparison of F5.

### Step 6 — Demo operations · not gated unless noted

- CI: typecheck, unit tests, and the Playwright suite (a11y, greyscale, keyboard) on every PR.
- Build and run `docker/Dockerfile.ingest` once end to end (never built so far).
- A hosted demo instance — **gated** (architecture: serving), and it raises U5 (anonymous access)
  and U10 (basemap.de 3D terrain is licensed *zu Testzwecken*) for decision, not by assumption.

## 4. Research that runs alongside, recorded rather than assumed

| Item | Unblocks | Status |
|---|---|---|
| Wind resource at hub height — a licence-clear source | Wind scoring | Not identified (`scoring-criteria.md` §3) |
| Settlement setbacks for wind — the Brandenburg rule and its geometry (CLC5 111/112 or DLM250) | Wind exclusion beyond protected areas | Geometry candidates exist (`sources.md` §4.1); the legal distance is not yet verified |
| *Bodenzahl*/*Ackerzahl* or another public soil-quality layer | Agri-PV differing from PV | BGR BÜK200 not usable for public outputs as things stand (`sources.md` §8) |
| EEG corridor-eligibility geometry | `pv_designated_corridor` | Not located as a dataset |
| Grid connection (U3) | PV and wind credibility | Open; out of this milestone |

## 5. Risks

- **Credibility:** confirming weights makes sela's statements about real land *stronger*. A
  confirmed but naive method is worse than a clearly illustrative one; Step 2 must be allowed to
  conclude "not yet".
- **Legal:** the exclusion rule (Step 1) is where sela comes closest to stating law. It must stay
  advisory in wording and cite the ordinance category, never imply a permission outcome.
- **Data:** Steps 3 and 4 each depend on a source or method not yet confirmed; both have a
  defined fallback (`not_modelled`), so neither blocks the milestone — they only weaken it.
- **Scope creep:** Step 5 is the easiest step to widen. It is limited to the flows already in
  `mvp.md` §6.
