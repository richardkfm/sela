# Decision memo — the energy outcome under `develop_pv` (`pv-yield-v1`)

**Version band:** `0.3.x` · **Status:** **implemented, pending the owner's confirmation in review.**
The decisions below were taken on 2026-09-28 under the owner's instruction to work through the
whole roadmap at once and to come back only with a summary. Each is the most conservative option
the evidence allows, and each is open to revision in the pull request. · **Last updated:**
2026-09-28 · Step 3 of `docs/product/roadmap-pilot-demo.md`

Step 3 asked for the second of sela's four questions, *what is gained*: annual yield per cell from
the ingested irradiation, through a **cited** specific-yield method and a **cited** land-use
density. The step was to ship as `not_modelled` if no citable method survived review.

**Evidence.** Sources read at source on 2026-09-28; the Uckermark database of that day (verdicts
`0.3.2-dev`). Queries and outputs are in `docs/domain/evidence/2026-09-28-energy-outcome/`.

---

## 1. What the sources say

| Factor | Value used (range) | Source, read at source |
|---|---|---|
| Transposition: plane-of-array over horizontal irradiation, south, 20°–25° | **1.15** (1.137–1.157) | Fraunhofer ISE, *Aktuelle Fakten zur Photovoltaik in Deutschland*, Fassung vom 20.8.2026, p. 37: *"Damit erhöht sich die Einstrahlungssumme bezogen auf die Modulebene um ca. 15 %"*. Range: PVGIS 5.3 (JRC, SARAH3 2005–2023) at 53.1° N 13.9° E, 20° → 1 257.07 / 1 106.06 = 1.137, 25° → 1 280.09 / 1 106.06 = 1.157 |
| Performance ratio (PR) of a plant built today, annual mean | **0.85** (0.80–0.90) | Same, p. 39: *"Eine heute installierte PV-Anlage erreicht PR-Werte von 80 – 90 % im Jahresmittel (typischer Wert), inkl. aller Verluste …"* |
| Definition of PR | Yf = PR × H_POA / G_STC, G_STC = 1 kW/m² | IEA-PVPS T13-28:2024, *Best practice guidelines for the use of economic and technical KPIs*, §2.1.2, p. 14. IEC 61724-1:2021 §14.3.1 names the same quantity; its text is paywalled and was **not** read |
| Area per installed capacity, new ground-mounted plants | **0.88 ha/MWp** (0.83–1.0) | ZSW (Kelm, Stauch), *Flächeninanspruchnahme von PV-Freiflächenanlagen – Update 2024*, 02.06.2025, for the EEG-Erfahrungsbericht: p. 3 *"bis 2021 auf 1 ha/MW und in den Folgejahren weiter auf 0,88 ha/MW im Jahr 2024 gesunken"*; p. 8, plants without EEG support *"0,83 ha/MW"*. Based on the *Marktstammdatenregister*; whether "MW" is DC or AC is not stated |
| Context, not an input | ~900 full-load hours for ground-mounted plants | IE Leipzig / r2b for the transmission system operators, *Mittelfristprognose … 2026 bis 2030*, 15.10.2025, p. 63: *"Eckwert von 900 VBS für Freiflächenanlagen"* — after curtailment |

Cross-checks that were read but not used as inputs: Fraunhofer ISE p. 40 (*"1 MWP/ha, 980
MWh/MWP"*), Böhm 2023 (*Berichte über Landwirtschaft* 101(1), yields per fenced area), UBA
*TEXTE* 76/2022 p. 22 (*"Flächenbedarfe zwischen 0,7 ha/MW und 1,5 ha/MW"*).

## 2. The method

**Yield [MWh/ha·a] = GHI [kWh/m²·a] × transposition × PR ÷ G_STC ÷ area per capacity [ha/MWp]**

- GHI is the cell's DWD value (`pv_irradiation_annual`, mean 2016–2025), already ingested.
- GHI × transposition × PR ÷ G_STC is the specific yield in kWh/kWp·a, which equals MWh/MWp·a.
- **Capacity [MWp/ha] = 1 ÷ area per capacity.**
- The **range** combines each factor's bounds in the direction that widens it. It is always
  shown; the central value never stands alone (ADR-0008 §2).

For a cell with GHI 1 120 kWh/m²·a this gives about **1 000 to 1 400 MWh/ha·a**, central
1 244. The capacity is 1.0 to 1.2 MWp/ha.

## 3. Options considered

| Option | What it means | Why not / why |
|---|---|---|
| **E-A — chosen** | The formula above, per cell, with the range | Every factor is cited at a page; it uses the irradiation sela already holds |
| E-B | One published figure (Fraunhofer's 980 MWh/MWp at 1 MWp/ha) for every cell | Not linked to the cell's irradiation. The same source's own p. 43 example gives about 1 080 full-load hours, so the flat figure is not self-consistent |
| E-C | A PVGIS query per cell | 117 191 API calls; SARAH3 radiation, not the DWD values the rest of sela reads; the PVGIS data licence beyond the manual's *"no restrictions"* was not verified |
| E-D | `not_modelled` | The fallback the roadmap allowed. Not needed: E-A survived review |

## Decisions (2026-09-28, under the owner's delegation)

| # | Question | Decision |
|---|---|---|
| E1 | Method | **E-A**, method version `pv-yield-v1`, dimension `energy`, two metrics: `pv_installed_capacity` (MWp/ha) and `pv_annual_yield` (MWh/ha·a) |
| E2 | Where it applies | **Only where the PV class allows a plant**: *ohne Einschränkung* and *eingeschränkt*. On *ausgeschlossen* and *nicht vorgesehen* cells the method finds nothing to measure (***trifft nicht zu***, "Freiflächen-PV hier ausgeschlossen oder nicht vorgesehen") — a yield there would contradict the class beside it. The method reads the same rules module as the classification (`lib/scoring/pv-rules.ts`) |
| E3 | Other scenarios | `status_quo`, `preserve`, `restore`: ***trifft nicht zu*** ("keine neue Anlage in diesem Szenario"). `develop_agripv`, `develop_wind`: **not modelled** — no cited density or yield |
| E4 | What the number is | The **technical** annual yield of a plant built today, **before curtailment**. The description says so and names the ~900 full-load hours the grid operators assume after curtailment. No statement on grid connection, economics or permission |
| E5 | Confidence | **low** everywhere: typical plant factors applied to a cell, not a plant design |
| E6 | Screens | The comparison table shows both metrics with their ranges; the decorative energy chart draws the range as a whisker; sites sum both metrics over their cells (Step 5) |

## 4. Result on the Uckermark (`a_yield.out`)

| `develop_pv` | Cells |
|---|---|
| modelled | 71 556 (all *ohne Einschränkung* and *eingeschränkt* cells with an irradiation value) |
| trifft nicht zu | 45 614 (18 363 *ausgeschlossen* + 27 251 *nicht vorgesehen*) |
| not modelled | 21 (no irradiation value; capacity is still shown) |

Central yields run from **1 222 to 1 263 MWh/ha·a** (median 1 248), a spread of **3.3 %**. The
widest range is 1 001 to 1 426. **Every modelled cell's range contains the region's best central
value.**

## 5. What this does not claim

- **It does not rank cells within the Uckermark.** Step 2 hoped the energy outcome would tell
  cells apart within a class. On the evidence it cannot: the irradiation differences are an
  order of magnitude smaller than the method's own uncertainty. It answers *how much* a plant
  would produce here, not *where it would produce more*.
- It is not a yield forecast for a real plant: no curtailment, no grid, no shading, no design.
- Capacity per hectare of **cell** assumes the whole cell becomes plant area.

## Open

- **Owner confirmation** of E1–E6 (this memo was written under delegation).
- Whether ZSW's MW is DC or AC; the IEC 61724-1 text itself; whether PVGIS's tilt ratio carries
  over to DWD GHI (assumed, stated as the range's source).
- Agri-PV density and yield, and the *land use* dimension (what agriculture loses), stay open.

## Risks

- **Credibility:** a technical yield is higher than what plants deliver after curtailment. The
  description says so, and the range is shown, never the central value alone.
- **Misreading as ranking:** the method page and this memo say it does not rank. The site view
  sums it, which is where it is most useful (a field block's order of magnitude).
