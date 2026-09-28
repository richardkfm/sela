# Decision memo — the first confirmed PV method (`real-pv-v1`)

**Version band:** `0.3.x` · **Status:** **decided** by the project owner on 2026-09-28 through
the `CLAUDE.md` §3 gate (see *Decisions*); **implemented** the same day (verdicts `0.3.2-dev`,
ADR-0009 amendment 1) · **Last updated:** 2026-09-28 · Step 2 of
`docs/product/roadmap-pilot-demo.md`

Step 2 asked for weights for the sourced PV criteria (`pv_irradiation_annual`, `pv_slope`,
`pv_land_cover`), a verdict threshold, and — "to be asked, not assumed" — whether a binary
*geeignet/ungeeignet* is the right presentation at all. After Step 1, land cover is a category, so
the weighted score has two inputs: irradiation on national bounds and slope. This memo records
what the measurements and the literature say about them, the options put to the owner, and the
decisions.

**Evidence.** The local Uckermark database of 2026-09-27 (Step 1 verdicts `0.3.1-dev`, 71 577
scored cells). Queries and outputs: `docs/domain/evidence/2026-09-28-pv-method/`.

---

## 1. What the measurements show

**Irradiation barely varies inside the Landkreis.** It runs from 1 100.5 to 1 137.0 kWh/m²·a
across scored cells. On the national p1–p99 scale that is 0.24 to 0.42. By national quartile,
99.8 % of the previously scored cells fall into the second quartile ("unteres Mittelfeld"), 157
into the first, and 21 have no value (`b_irradiation_quartiles.out`).

**Slope barely varies either.** On DGM200 the median is 0.72°, p99 is 3.3° and the maximum is
6.8°. Only 39 scored cells exceed 5° (`a_variants.out` §A).

**The verdict follows the parameters, not the land.** The unsuitable share of the 71 577 cells
was recomputed for:

- irradiation weights of 0.25, 0.5 and 0.75 (slope takes the rest);
- slope bounds of 5°, 10° and 15°;
- thresholds of 0.4, 0.5, 0.6 and 0.7.

Across these 36 combinations it runs from **0 % to 100 %** (`a_variants.out` §C). With equal
weights and a 10° bound:

| Threshold | Unsuitable cells |
|---|---|
| 0.5 | 0.6 % |
| 0.6 | 17.4 % |
| 0.7 | 99.8 % |

90 % of scores sit between 0.563 and 0.684. Slope contributes about three times the variance of
irradiation (§D), so "suitability" becomes almost entirely a statement about a 200 m slope.

## 2. What the sources say

This was read at source on 2026-09-28 unless marked otherwise. The research notes list every
source.

### German guidance

| Source | Finding |
|---|---|
| **Brandenburg:** MLUK/MIL/MWAE, *Gemeinsame Arbeitshilfe PV-FFA* (August 2023), p. 21 | "So ist zum Beispiel eine Nutzung von Hängen zu vermeiden." No number; the reason given is the landscape, not yield. The 2021 MLUK *Handlungsempfehlung* (p. 7) says the same. |
| **UBA:** *Umweltverträgliche Standortsteuerung von Solar-Freiflächenanlagen* (2022) | Hillsides can be favourable for energy but visually harmful; no number. |
| **Bayern:** StMB *Rundschreiben* (2021) | Lists *Hanglagen* among *eingeschränkt geeignete Standorte*; no number. |
| **Regionalverband Bodensee-Oberschwaben:** *Kriterienkatalog Vorbehaltsgebiete Photovoltaik* (2023) | Classifies slope 15 to < 25 % as *Konflikt* and ≥ 25 % as *erheblicher Konflikt*. Irradiation > 1 150 kWh/m² counts as *Eignung*. It uses ordinal classes, no weights. |

The Bodensee-Oberschwaben catalogue is for another region. **No Uckermark cell reaches 1 150**
(maximum 1 137.0), so its irradiation class would not carry over.

### Literature

| Source | Finding |
|---|---|
| Ryberg et al. 2018 (*Energies* 11:1246), a review of 53 land-eligibility studies | The common slope exclusion is 10°. |
| Tröndle et al. 2019 | Open-field PV below 10°. |
| Durlević et al. 2026 | Weights come from AHP; slope is scored in 5° steps, not excluded. |

No source gives a citable **threshold for a weighted composite**. Weights are set per study.

### Resolution

Coarser DEMs systematically flatten slopes (Grohmann 2015, *Computers & Geosciences* 77). The
practitioner sources use 1–30 m models. No source names 200 m specifically.

**Reading:** none of the cited slope limits bites in the Uckermark on the data sela holds. No
source supports a weight or a threshold that sela could cite. Confirming numbers now would be
the "confirmed but naive method" the roadmap's risk list warns against.

## 3. Options put to the owner

**P — presentation**

| Option | What it means |
|---|---|
| P1 | No composite, only decided states and measured values |
| **P2 — decided** | Classes per criterion, never combined (the Bodensee-Oberschwaben pattern) |
| P3 | Confirm a weighted score and threshold |
| P4 | "Not yet", and keep the illustrative score |

**S — slope**

| Option | What it means |
|---|---|
| **S1 — decided** | Measured value only, at low confidence |
| S2 | Exclusion from 10° |
| S3 | Wait for a finer DGM, which is a separate data-source gate |

## Decisions (2026-09-28)

| # | Question | Decision |
|---|---|---|
| D1 | Presentation | **Classes per criterion, never combined.** No score and no *geeignet/ungeeignet* for real regions. See the list below. |
| D2 | Slope | **Measured value only.** Low confidence, with the DGM200 caveat. Brandenburg's "Hängen zu vermeiden" is quoted without a number. |
| D3 | What the map colours | **Four classes plus a Prüfhinweis marker:** *ohne Einschränkung* / *eingeschränkt* / *nicht vorgesehen* / *ausgeschlossen*. Cells with at least one Prüfhinweis get a dashed contour from zoom 12. |
| D4 | Names | **Neutral names on map, legend and screens.** "Vorgesehen" could be read as "im Plan vorgesehen", so the tier *vorgesehen* reads *ohne Einschränkung*. The tier names stay in the method. |
| D5 | Banner | The **ILLUSTRATIV banner goes on the PV path for real regions.** An advisory note ("beratend, keine Planungs- oder Genehmigungsaussage") replaces it. The synthetic fixture keeps its banner and its illustrative score. |

The classes behind D1:

- **Protection:** *ausgeschlossen* or not (Step 1).
- **Land cover:** its tier (Step 1).
- **Irradiation:** its national quartile, shown but not combined.
- **Slope:** its measured value (D2).

A cell's class follows from protection and land cover alone.

## 4. Result on the Uckermark (`c_verdicts_real_pv_v1.out`)

For PV (agri-PV identical):

| Class | Cells | with ≥ 1 Prüfhinweis |
|---|---|---|
| ohne Einschränkung | 59 438 | 29 559 |
| eingeschränkt | 12 139 | 8 611 |
| nicht vorgesehen | 27 251 | 20 099 |
| ausgeschlossen | 18 363 | 18 354 |

Wind: 18 363 excluded; otherwise not assessed.

## 5. What this does not claim

- **It does not rank.** `mvp.md` names a project developer who wants to "rank candidates"; the
  method gives no order within a class. The energy outcome (roadmap Step 3) is the candidate for
  a cited difference between cells.
- **"Ohne Einschränkung" is not "geeignet".** It means that none of the checked reasons speaks
  against the cell. Grid connection (U3), soil quality, the *Flächennutzungsplan* and the
  ordinances behind the Prüfhinweise are not checked.

## Risks

- **Credibility:** a four-class map with no score may read as less decisive. That is the
  intended honesty, and the method page says why.
- **Legal:** the class names stay advisory. The flags keep "Übersichtsdaten des LfU".
- **Data:** slope stays unused until a finer DGM passes its own data-source gate.
