# Decision memo — the four placeholder scoring rules

**Version band:** `0.3.x` · **Status:** **Q1–Q5 decided** by the project owner on 2026-09-27
through the `CLAUDE.md` §3 gate (see *Decisions* and *Follow-up decisions*); **implemented** the
same day as `illustrative-real-v1` / verdicts `0.3.1-dev` (ADR-0009) · **Last updated:** 2026-09-27 ·
Step 1 of `docs/product/roadmap-pilot-demo.md`

`docs/domain/scoring-criteria.md` §6 lists four placeholder rules under `illustrative-real-v0`
that await a decision. This memo puts each one as options, with the **measured** effect of every
option on the Landkreis Uckermark, and a recommendation. The owner decides; the decisions are then
recorded in `scoring-criteria.md` and implemented as a new `method_version`, never as an edit of
`illustrative-real-v0`.

**Evidence.** All numbers come from a local rebuild of the real pipeline on 2026-09-27 (all seven
confirmed sources fetched that day; 117 191 cells; 3 044.7 km² of grid). The recompute of the
stored verdicts reproduces them exactly, so the variants below run through sela's own
`computeSuitability`. Queries, scripts and raw outputs:
`docs/domain/evidence/2026-09-27-scoring-rules/`.

**Law quoted below** was read at `gesetze-im-internet.de` on 2026-09-27 (BNatSchG §§ 23, 24, 26,
34). Quoting a statute is not legal advice, and sela stays advisory (`CLAUDE.md` §5).

---

## Q1 — Which protection categories exclude?

### What the law says

| Category | Rule | Nature of the rule |
|---|---|---|
| *Naturschutzgebiet* (NSG) | § 23 Abs. 2: "Alle Handlungen, die zu einer Zerstörung, Beschädigung oder Veränderung des Naturschutzgebiets … führen können, sind **nach Maßgabe näherer Bestimmungen** verboten." | Prohibition, detailed by each area's ordinance |
| Nationalpark | § 24 Abs. 3: "… wie Naturschutzgebiete zu schützen." | As NSG |
| Natura 2000 (FFH, SPA) | § 34 Abs. 1: projects "sind vor ihrer Zulassung … auf ihre Verträglichkeit … zu überprüfen"; Abs. 2: unzulässig **if** the assessment finds significant harm | **Assessment duty**, not a ban |
| *Landschaftsschutzgebiet* (LSG) | § 26 Abs. 2: actions that "den Charakter des Gebiets verändern" are prohibited "nach Maßgabe näherer Bestimmungen"; Abs. 3: wind turbines **not prohibited** in a *Windenergiegebiet* (§ 2 Nr. 1 WindBG) — and, until the Land's *Flächenbeitragswert* is reached, anywhere in the LSG — **except** inside Natura 2000 | Depends on the ordinance; for wind, a statutory release with a Natura 2000 carve-out |
| Biosphärenreservat | Not read at primary source for this memo | — |

### Measured (share of the Landkreis, union of areas clipped to the boundary)

| Category | km² | % of Landkreis |
|---|---|---|
| NSG | 490.9 | 15.9 |
| Nationalpark Unteres Odertal | 99.8 | 3.2 — **lies entirely inside NSG polygons** |
| FFH | 675.2 | 21.9 |
| SPA | 1 478.5 | 48.0 |
| FFH ∪ SPA | 1 631.9 | 52.9 |
| LSG | 1 252.4 | 40.6 |
| Biosphärenreservat Schorfheide-Chorin | 598.6 | 19.4 |
| Any of the six | 1 938.1 | 62.9 |

| Option | Cells excluded | % of cells |
|---|---|---|
| **1a** NSG + Nationalpark (current) | 18 363 | 15.7 |
| **1b** NSG + NP + FFH + SPA | 62 293 | 53.2 |
| **1c** NSG + NP exclude; FFH/SPA shown as *Verträglichkeitsprüfung erforderlich* (a flag, not an exclusion); LSG shown as *Schutzgebietsverordnung prüfen* | 18 363 | 15.7, plus flags |

### Recommendation: **1c**

1b states something the law does not: § 34 is a duty to assess, not a prohibition, and 1b would
paint over half the Landkreis as closed. 1a is legally closer but silent — a cell in an SPA
currently looks exactly like one outside it. 1c keeps the exclusion to the categories whose
statute prohibits, and makes the rest *visible* as a named, cited condition. That serves the
investor's question in `mvp.md` §2 ("where is the conflict risk?") without inventing a ban.

1c adds a **new user-visible state** (a flag next to a verdict) — this is a design-language and
user-visible-behaviour decision as well as a scoring one. Wording must stay advisory.

**Caveat on the data itself:** the LfU service describes its protection geometry as overview
data, digitised at 1:10 000 and **not legally binding**. Whatever the rule, the exclusion text
should say "nach den Übersichtsdaten des LfU", not "liegt im Naturschutzgebiet".

---

## Q2 — When is a cell "inside"?

A 100 m cell (2.6 ha) is a statement about sela's grid, not about law (ADR-0001). The ordinance
applies to its whole area.

| NSG + NP share of a cell | Cells |
|---|---|
| 0 | 95 304 |
| 0 < share < 0.5 | 3 524 |
| 0.5 ≤ share < 1 | 3 264 |
| 1 (fully inside) | 15 099 |

| Option | Cells excluded | Difference to today |
|---|---|---|
| **2a** share ≥ 0.5 (current) | 18 363 | — |
| **2b** any overlap | 21 887 | +3 524 |
| **2c** cell centre inside | 18 391 | 312 cells differ from 2a in either direction |
| **2d** share ≥ 0.5 excludes; 0 < share < 0.5 flagged *teilweise im Schutzgebiet (x %)* | 18 363 | + 3 524 flagged |

### Recommendation: **2d**

2a and 2c are practically the same line (312 cells apart), so the choice between them is not
worth arguing. 2b is the most cautious but calls 3 524 cells "excluded" when most of their area
is outside any protected area. 2d keeps today's line and stops hiding the partial overlap: the
share is already stored per cell, so the interface can state it. The same flag mechanism as Q1c.

---

## Q3 — The land-cover score table

### Measured

The dominant CLC5 class, by share of cells: arable land (211) 52.2 %, coniferous forest (312)
14.8 %, meadows and pastures (231) 11.2 %, broadleaf forest (311) 6.9 %, water (512) 3.4 %,
discontinuous settlement (112) 2.8 %, mixed forest (313) 2.8 %, natural grassland (321) 1.9 %,
industry (121) 1.2 %, marsh (411) 1.0 %; 15 further classes below 0.6 % each. The dominant
class covers less than half its cell in 1.7 % of cells (already confidence `low`).

Under today's scoring, land cover is the limiting criterion for **every unsuitable cell but one**
(26 518 of 26 519). The table therefore decides, almost alone, which non-protected land sela
calls unsuitable for PV. It has 37 graded values from 0 to 1 (e.g. meadows 0.7, arable 1.0,
industry 0.6) with no written reason for any of them.

### Options

- **3a — keep a graded table,** but write a cited rationale per class. Most expressive; each grade
  is a separate claim that must be defended, and the grades imply a precision no source supplies.
- **3b — three tiers**: *vorgesehen* / *eingeschränkt* / *nicht vorgesehen*, each class assigned
  with a one-line written reason (e.g. forest, water, settlement, marsh: not considered for
  ground-mounted PV). Fewer claims, each defensible, published on the method page.
- **3c — move land cover out of the score** into a categorical filter (*nicht vorgesehen* classes
  excluded or flagged, everything else neutral), and let the remaining criteria rank.

### Recommendation: **3b**

The table is the most value-laden placeholder: "arable land is where PV goes" is a contested
position (it is exactly the conflict agri-PV exists to soften). sela should not bake a stance
into a decimal. Three tiers with written reasons make the stance explicit and reviewable, and
the cost to agriculture belongs on the outcome side (`land_use` dimension), not hidden in
suitability. **Owner input needed:** the tier of each class — a proposed assignment would be a
follow-up to this memo, not part of it.

---

## Q4 — Irradiation bounds

### Measured (kWh/m²·a, 2016–2025 mean)

| | min | p5 | median | p95 | max |
|---|---|---|---|---|---|
| Uckermark cells | 1 100.4 | 1 103.7 | 1 122.3 | 1 134.8 | 1 137.0 |
| Germany, 1 km pixels | 1 037.2 | 1 062.9 | 1 137.2 | 1 245.4 | 1 271.4 |

The whole Landkreis spans **36.6 kWh/m²·a**. 23.9 % of German pixels lie below its minimum,
49.9 % at or below its maximum — it sits in the lower-middle of the national range.

### Effect on PV verdicts (all other placeholders unchanged)

| Option | Suitable | Unsuitable | Irradiation "limiting" among suitable cells |
|---|---|---|---|
| **4a** 1 000–1 300 (current) | 72 309 | 26 519 | 98.9 % |
| **4b** Germany p1–p99 (1 050.5–1 257.1) | 72 010 | 26 818 | 99.4 % |
| **4c** Germany min–max (1 037.2–1 271.4) | 72 054 | 26 774 | 99.3 % |
| **4d** irradiation removed from the score | 72 760 | 26 068 | — (slope limiting in 59 570 cells, 17 194 of them on a shortfall < 0.05) |
| **4e** Uckermark min–max (1 100.4–1 137.0) | 81 575 | 17 253 | 72.1 % |

### What the numbers show

1. **4a, 4b and 4c are practically the same** (≤ 299 cells change verdict). The choice among
   national bounds is not the problem.
2. **The problem is the "limiting criterion" rule, not the bounds.** Inside one Landkreis,
   irradiation is a near-constant penalty (shortfall 0.54–0.67 in every cell under 4a, 0.58–0.76 under 4b), so "the criterion
   that would raise the score most if perfect" is irradiation almost everywhere — true, and
   useless for telling cells apart. Removing it (4d) just moves the label onto slope, often on a
   trivial shortfall (terrain is flat: median 0.7°, maximum 7.2°, no cell reaches the 10° bound).
3. **4e must be ruled out.** Stretching a 37 kWh/m² spread to the full 0–1 scale turns 9 266
   cells suitable — including **9 056 cells whose land-cover score is 0** (forest, settlement,
   water, marsh). Regional normalisation manufactures differences that are not in the land.

### Recommendation: **4b, plus a follow-up question on the limiting-criterion rule**

- Take bounds from the **measured national distribution** (p1–p99 of the same DWD 2016–2025
  mean): derived from data sela already holds, reproducible, and comparable if a second region
  is ever added — rather than the round numbers of 4a.
- Show irradiation with its **national position** (e.g. "im bundesweiten Vergleich unteres
  Mittelfeld") — that is the honest reading of a regionally near-constant value.
- **New question for the owner (Q5):** should "limiting criterion" only be named when its
  shortfall exceeds a stated minimum, and/or only among criteria that actually vary across the
  compared land? That changes flow F2's logic, so it is a §3 scoring decision in its own right.
- Longer term, irradiation's main job is the **energy outcome** (roadmap Step 3): how much is
  gained, not whether the cell is suitable.

---

## Decisions (2026-09-27)

The project owner chose the recommended option for each of Q1–Q4. Recorded here and in
`scoring-criteria.md` §6. The implementation is its own change, under a new `method_version`;
three parts of it needed owner input before code (answered in *Follow-up decisions*):

- the **wording and visual treatment** of the new flags (Q1c, Q2d) — user-visible behaviour and
  design language, proposed separately;
- the **tier of each CLC class** (Q3b) — a proposed assignment with a reason per class, for review;
- **Q5**, the limiting-criterion rule.

## Follow-up decisions (2026-09-27, before implementation)

The three open inputs were put to the project owner in two rounds, the second with measured
effects (`evidence/2026-09-27-scoring-rules/evidence.md` §F). Decided:

| # | Question | Decision |
|---|---|---|
| F1 | Tier of arable land (211) and grassland (231) | 211 *vorgesehen*, 231 *eingeschränkt*; the rest of the proposed table as written. Classes absent from the Uckermark assigned by analogy (`scoring-criteria.md` §6) |
| F2 | How the tiers enter the verdict | **As a category, not a score** — land cover leaves the weighted score entirely (closer to option 3c, keeping 3b's three written tiers) |
| F3 | What *nicht vorgesehen* does, given F2 | **Its own verdict state**, *nicht vorgesehen*, with no score and its own map class — not *ausgeschlossen*, and not a note beside *geeignet* (measured: 26 930 forest/water/settlement cells would otherwise read *geeignet*) |
| F4 | Q5, precisely | A criterion is named as limiting only if its normalised value lies **at least 0.1 below the best value of that criterion among the scored cells of the region**; otherwise none is named. (The first-round wording — shortfall ≥ 0.1 among criteria that vary — was measured to leave irradiation "limiting" in 71 572 of 71 577 cells.) |
| F5 | Wording and treatment of the flags | As proposed: a neutral *Prüfhinweis* with § glyph under the verdict, naming the area (new table of overlaps with name and *Gebietsnummer*), its share, "nach den Übersichtsdaten des LfU" and the provision (§ 34 for FFH/SPA, § 26 for LSG, § 23/§ 24 for a partial NSG/Nationalpark) |
| F6 | Minimum share for a flag | **1 % of the cell**; smaller overlaps are within the digitising accuracy (1:10 000) and are stored but not shown |

Not decided by the owner and therefore left as they were: the Biosphärenreservat is not flagged
(§ 25 BNatSchG not read at source); flags are worded for ground-mounted PV and agri-PV only.

**Measured result** (`evidence.md` §G): of 117 191 cells, 18 363 *ausgeschlossen*, 27 251 *nicht
vorgesehen*, 71 154 *geeignet*, 423 *ungeeignet* (all limited by slope). Among *geeignet* cells,
irradiation is named in 12 189, slope in 22 553, none in 36 412. That almost every scored cell
passes the placeholder threshold is a finding for Step 2 (whether a binary threshold is the right
presentation at all), not something this change hides.

## Summary of options

| # | Question | Recommended → **decided** | Also a decision about |
|---|---|---|---|
| Q1 | Categories that exclude | **1c** NSG + NP exclude; FFH/SPA and LSG flagged — **decided** | user-visible state, wording |
| Q2 | When a cell is inside | **2d** share ≥ 0.5 excludes; partial overlap flagged with its share — **decided** | same flag mechanism |
| Q3 | Land-cover table | **3b** three tiers with written reasons — **decided**; tier assignment to follow | — |
| Q4 | Irradiation bounds | **4b** national p1–p99; never regional — **decided** | — |
| Q5 | *(new)* Limiting-criterion rule | **decided** (F4): gap ≥ 0.1 to the region's best value, else none named | flow F2 |

## Risks

- **Legal:** flags (1c, 2d) put statute names on real land. Wording must name the source
  ("Übersichtsdaten des LfU") and the duty ("Prüfung erforderlich"), never a permission outcome.
- **Credibility:** the placeholder banner comes off only after Step 2 (weights); deciding these
  rules alone does not make the PV verdict confirmed.
- **Data:** the evidence was measured on one rebuild on 2026-09-27; a later source version
  (e.g. CLC5-2021, `sources.md` §8) changes the counts but not the reasoning.
