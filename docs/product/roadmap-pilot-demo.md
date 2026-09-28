# Roadmap — from illustrative scoring to a credible pilot demo

**Version band:** `0.3.x` · **Status:** milestone chosen by the project owner 2026-09-27; Steps 1
and 2 decided through the `CLAUDE.md` §3 gate; Steps 3–6 implemented on 2026-09-28 under the
owner's instruction to work through the whole roadmap at once, **pending the owner's confirmation
in review** (each step's memo lists its decisions) · **Last updated:** 2026-09-28 (Steps 1–5
done, Step 6 done except hosting)

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
| Four placeholder rules awaiting a decision — **resolved by Step 1** (weights, slope bounds, threshold remain) | `scoring-criteria.md` §6.1 | Irradiation is "limiting" almost everywhere — an artefact of the bounds |
| No energy outcome — **addressed by Step 3** (`pv-yield-v1`) | `scoring-criteria.md` §4 | *develop* shows what it costs, never what it gains — the second of sela's four questions goes unanswered |
| Wind never scored; agri-PV identical to PV | `scoring-criteria.md` §2–3, §6 | Two of three technologies are placeholders |
| Habitat not shown — **addressed by Step 4** (categories) | `scoring-criteria.md` §4.3 | *nature capital* is *noch nicht modelliert* on every cell |
| No search, no multi-cell selection — **addressed by Step 5** | `mvp.md` F1, F6 | A council member cannot find "their" land; a hex cell is not what a council names (ADR-0001) |
| No CI; ingest image never built; nothing hosted — **CI and image by Step 6; hosting open** | `CHANGELOG.md` *Open* | The demo exists only on a developer machine |

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
the Uckermark pipeline). It adds a fifth question — how flow F2 names the limiting criterion —
because the measurements show that, not the bounds, is what makes irradiation "limiting" almost
everywhere.

**Status: done (2026-09-27).** Q1–Q5 and six follow-up questions (tiers, land cover as a category,
a *nicht vorgesehen* state, the precise Q5 rule, flag wording, a 1 % flag minimum) decided by the
owner; implemented as `illustrative-real-v1` (verdicts `0.3.1-dev`) with ADR-0009 and recorded in
`scoring-criteria.md` §6.1. What it leaves for Step 2: with land cover out of the score, 99.4 % of
scored Uckermark cells pass the placeholder threshold — the question "is a binary threshold the
right presentation?" is now concrete, not hypothetical.

### Step 2 — First confirmed PV method (`real-pv-v1`) · gated (scoring)

Weights for the PV criteria that have sources (`pv_irradiation_annual`, `pv_land_cover`,
`pv_slope`), the verdict threshold, and — to be asked, not assumed — whether a binary
*geeignet/ungeeignet* threshold is the right presentation at all, or whether the score is shown
with its decomposition only. Each weight carries a written rationale in `scoring-criteria.md` §2.
Output: a seed migration, the banner removed for the PV path only, method page updated from the
same rows.

**Status: done (2026-09-28)** — and it concluded that the binary threshold is *not* the right
presentation. Measured: the unsuitable share moved between 0 % and 100 % across plausible weights,
slope bounds and thresholds, and no source supports citable values. Decided by the owner
(`docs/domain/decision-memo-pv-method.md`): **classes per criterion, never combined** — the cell's
class from protection and land cover (*ohne Einschränkung* / *eingeschränkt* / *nicht vorgesehen*
/ *ausgeschlossen*), irradiation by national quartile, slope as a measured value only; a dashed
contour for cells with Prüfhinweise; the *ILLUSTRATIV* banner removed for real regions. With this,
the milestone's condition for the PV path holds: every number is backed by a decided rule or a
measurement, or is visibly *nicht bewertet*. Step 3 (energy yield) is what can tell cells apart
within a class.

### Step 3 — Energy outcome under `develop_pv` · gated (scoring, data)

Answers "what is gained": annual yield per cell from the ingested irradiation, through a **cited**
specific-yield method and a **cited** land-use density for ground-mounted PV. Neither citation is
chosen yet — the step starts with sourcing them, and ships as `not_modelled` if no citable method
survives review (`CLAUDE.md` §4.3 applies to energy too). Follows ADR-0008's provenance pattern.

**Status: done (2026-09-28), pending confirmation** — `docs/domain/decision-memo-energy-outcome.md`.
`pv-yield-v1`: capacity and technical annual yield of a new plant, from GHI × transposition (1.15,
Fraunhofer ISE) × PR (0.85, Fraunhofer ISE) ÷ 0.88 ha/MWp (ZSW 2025), always with its range
(about 1 000–1 400 MWh/ha·a), only where the PV class allows a plant. **Finding:** it does not
tell Uckermark cells apart — central values span 3.3 %, far inside the method's range. The
question "where within a class" stays open; the energy outcome answers "how much", and sums
usefully over a site (Step 5).

### Step 4 — Habitat as categories · gated (data)

The LfU *Biotopkataster* view already scoped in `scoring-criteria.md` §4.3: protected biotope yes/no,
FFH *Lebensraumtyp* and conservation status — facts, not a score. Blocked first on clarifying the
INSPIRE Art. 13(1)(e) restriction note with LfU (`sources.md` §8).

**Status: done (2026-09-28), pending confirmation** — `docs/domain/decision-memo-habitat.md`. Read
at source, the note is Art. 13(1)(e) *intellectual property*, on the service records only; the
dataset has *"Zugriffsbeschränkung keine"* and is an open download. The licence differs between
metadata (`dl-de/by-2-0`) and documentation (CC BY 4.0) — both permit the use; the question is
drafted for LfU. Shown as categories on every cell screen; not used by the PV class. **Left to the
owner:** 16 519 PV-*ohne Einschränkung*/*eingeschränkt* cells contain a biotope recorded as
protected — whether that becomes a Prüfhinweis (H4).

### Step 5 — Finding and grouping land · gated (user-visible behaviour)

- **F1 search** by *Gemeinde* and coordinates. The *Gemeinde* boundaries would come from the
  already-confirmed VG25 archive (whether its fetched version carries the municipality layer is
  to be checked, not assumed). Address search needs a geocoder — a new data source, separately gated.
- **Multi-cell selection** (a drawn or clicked group of cells, summarised as one "site"), which is
  the practical answer to ADR-0001's admitted gap until *Flurstück* geometry is affordable.
- **F6** parcel-vs-parcel comparison and the printable comparison of F5.

**Status: done (2026-09-28), pending confirmation** — `docs/domain/decision-memo-finding-land.md`.
*Gemeinde* search (VG25 `vg25_gem` carries the layer: 30 *Gemeinden*) and coordinate search
(WGS84, ETRS89/UTM); no address search (geocoder gated). Several cells by Shift-click or a panel
button, summarised at `/site` (counts, area sums stating their coverage) or side by side at
`/compare` (2–6 cells, one scenario, no ranking); all three comparisons print with sources, date
and advisory note.

### Step 6 — Demo operations · not gated unless noted

- CI: typecheck, unit tests, and the Playwright suite (a11y, greyscale, keyboard) on every PR.
- Build and run `docker/Dockerfile.ingest` once end to end (never built so far).
- A hosted demo instance — **gated** (architecture: serving), and it raises U5 (anonymous access)
  and U10 (basemap.de 3D terrain is licensed *zu Testzwecken*) for decision, not by assumption.

**Status (2026-09-28):**

- **CI: done.** `.github/workflows/ci.yml` runs typecheck and unit tests, and the Playwright suite
  against the fixture on a PostGIS service, on every pull request and on `main`.
- **Ingest image: built and run end to end.** The first build showed the image could not work
  (Alpine's PROJ broke GDAL); rebased on Ubuntu 24.04 (ADR-0010). The fixture pipeline and the
  real Uckermark pipeline both ran in the container.
- **Hosted demo: not done.** It needs decisions only the owner can take — where it runs (serving
  architecture), U5 (anonymous access) and U10 (the 3D terrain's test-only licence, which rules
  out a public preview as it stands). Nothing was deployed.

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
