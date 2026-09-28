# Scoring criteria catalogue

**Version band:** `0.2.x`–`0.3.x` · **Status:** **PV decided as a classification without weights** (`real-pv-v1`, §6.2); wind and agri-PV-specific criteria open; first real `preserve`/`restore` methods decided — climate and water (§4) · **Last updated:** 2026-09-28

This is the document `docs/product/mvp.md` §4 names as the place nothing about technology
suitability is settled until it is cited here, and the document `lib/db/migrations/0002_domain_schema.sql`'s
`criterion_definition` rows are written from once it closes.

**This document does not yet close.** Naming a criterion, its candidate source, and its direction
is domain modelling. Assigning it a numeric **weight** is a scoring decision — `CLAUDE.md` §3 puts
"criteria, weights, normalization, aggregation, thresholds" behind the confirmation gate, because
changing a weight changes what the public is told about real land. No row below carries a weight.
Real `criterion_definition` rows are not inserted into the database until each technology's weight
set has been confirmed, criterion by criterion, in a change that goes through that gate explicitly
— this catalogue is the input to that conversation, not a substitute for it.

Every row's **source** column is either a `docs/data/sources.md` dataset, or `not yet identified`
if `mvp.md` §4 named the input but no candidate dataset has been found. A criterion with no
identified source cannot get a `criterion_definition` row at all (`criterion_value.source_id NOT
NULL`, roadmap §4.1) — those rows are placeholders for future work, not gaps quietly filled by
inventing a source.

---

## How to read this table

| Column | Meaning |
|---|---|
| `id` | The stable identifier this criterion will use in `criterion_definition.id` once confirmed |
| Direction | `higher_better` / `lower_better` / `non_monotonic` — a methodological fact (does more of this measured quantity make the site more suitable), not a value judgement, so it is stated here rather than deferred |
| Hard constraint? | Whether ADR-0004's filter path applies — set only for statutory eligibility gates, never for anything continuous |
| Weight | Always **open** in this document — see above |
| Candidate source | The `docs/data/sources.md` row this would read from, or `not yet identified` |

---

## 1. Ground-mounted solar PV (`develop_pv`)

Criteria named in `docs/product/mvp.md` §4.1.

| id | Name (EN / DE) | Direction | Hard constraint? | Weight | Candidate source |
|---|---|---|---|---|---|
| `pv_irradiation_annual` | Annual solar irradiation / Jährliche Sonneneinstrahlung | `higher_better` | No | **none** — classed by national quartile, not combined (§6.2) | DWD CDC radiation grids, 2016–2025 mean — **confirmed, ingested** (`sources.md` §2.3, §5.2) |
| `pv_slope` | Terrain slope / Geländeneigung | `lower_better` | No | **none** — measured value only (§6.2) | BKG DGM200 — **confirmed, ingested**; 200 m, so confidence `low` (`sources.md` §2.7) |
| `pv_aspect` | Terrain aspect / Hangausrichtung | `non_monotonic` | No | open | BKG DGM200 could supply it; not derived — at 200 m aspect is not meaningful per cell |
| `pv_parcel_contiguity` | Contiguous usable area / Zusammenhängende nutzbare Fläche | `higher_better` | No | open | Derived from `spatial_unit` geometry itself once real parcel/grid geometry exists — no external source needed |
| `pv_land_cover` | Current land-cover class / Aktuelle Bodenbedeckungsklasse | `non_monotonic` | No | **none** — a category in three tiers (§6.1) | BKG CORINE Land Cover 5 ha (CLC5-2018) — **confirmed, ingested**; the cell's dominant class (`sources.md` §2.2) |
| `pv_designated_corridor` | Eligible designated corridor (motorway/rail) / Förderfähiger Seitenrandstreifen | `non_monotonic` | No | open | Not yet identified — the EEG/state corridor-eligibility geometry has not been located as a dataset |
| `pv_protection_status` | Protection-area exclusion / Schutzgebietsausschluss | — (exclusion only) | **Yes** | n/a — exclusion, not scored | BfN Schutzgebiete (WFS) — licence cleared, access blocked; **Brandenburg: LfU Schutzgebiete, confirmed, ingested** (`sources.md` §2.1, §2.8) |

**Excluded from this catalogue, not silently assumed:** grid-connection proximity (*Netzverknüpfungspunkt*)
is named in `mvp.md` §4.1 as a suitability driver, but its MVP scope is open (**U3**) and no public
source for connection-point capacity has been identified. It is not listed as a criterion until U3
resolves.

## 2. Agrivoltaics (`develop_agripv`)

Criteria named in `docs/product/mvp.md` §4.2 — all PV criteria above apply
(`applies_to` includes `develop_agripv` for each), plus:

| id | Name (EN / DE) | Direction | Hard constraint? | Weight | Candidate source |
|---|---|---|---|---|---|
| `agripv_crop_shade_tolerance` | Current crop shade tolerance / Schattentoleranz der Anbaukultur | `higher_better` | No | open | Not yet identified — requires a crop-type layer (e.g. state agricultural registers) not yet located |
| `agripv_soil_quality` | Soil quality (*Bodenzahl* / *Ackerzahl*) / Bodenqualität | `higher_better` | No | open | Not yet identified — *Bodenzahl*/*Ackerzahl* are held per-*Bundesland*; no public dataset confirmed yet |
| `agripv_field_geometry` | Field geometry and machinery access / Feldgeometrie und Maschinenzugang | `higher_better` | No | open | Derived from `spatial_unit`/parcel geometry, same basis as `pv_parcel_contiguity` |
| `agripv_continued_ag_use` | Continued agricultural use feasibility / Fortführbarkeit landwirtschaftlicher Nutzung | `higher_better` | No | open | Not yet identified |

## 3. Onshore wind (`develop_wind`)

Criteria named in `docs/product/mvp.md` §4.3.

| id | Name (EN / DE) | Direction | Hard constraint? | Weight | Candidate source |
|---|---|---|---|---|---|
| `wind_resource_hub_height` | Wind resource at hub height / Windressource in Nabenhöhe | `higher_better` | No | open | Not yet identified — candidate: DWD wind atlas / TrassenCheck-class data, not yet added to `docs/data/sources.md` |
| `wind_settlement_setback` | Statutory settlement setback distance / Gesetzlicher Siedlungsabstand | — (exclusion only) | **Yes** | n/a — exclusion, not scored | OpenStreetMap via Geofabrik (settlement geometry) for the geometry input; the setback *distance* itself is a state-specific statutory value not yet catalogued per *Bundesland* |
| `wind_protection_status` | Protection-area and species-sensitivity exclusion / Schutzgebiets- und Artenschutzausschluss | — (exclusion only) | **Yes** | n/a — exclusion, not scored | BfN Schutzgebiete (WFS) for protection areas — Brandenburg: LfU Schutzgebiete, ingested (§6); raptor/bat species-sensitivity layer not yet identified (tracked against U2) |
| `wind_terrain_access` | Terrain and access suitability / Gelände- und Erschließungseignung | `higher_better` | No | open | Same DEM candidate as `pv_slope`, not yet identified |

**Excluded from this catalogue, not silently assumed:** grid-connection proximity, same basis as
§1 (U3).

## 4. Status quo, preserve, restore — outcome-side, not suitability-side

`status_quo`, `preserve`, and `restore` are not scored for *suitability* (`suitability_verdict`
only applies to `develop_*`) — they produce `outcome` rows directly, across the six shared
dimensions (`mvp.md` §8.3). Which criteria feed each outcome dimension for these three scenarios
is **U2** (nature-capital indicators): `mvp.md` §5 rule 2 requires them to be quantified, not
residual, and per `CLAUDE.md` §5 no indicator is listed until it is citable to an established
method. Every dimension without such a method stays `status = 'not_modelled'`.

**U2 is partly closed (2026-09-24).** The project owner decided, through the `CLAUDE.md` §3 gate,
to model **climate** (peat soils) and **soil and water** (water balance) for the Uckermark, and to
show **nature capital only as categories** for now (§4.3). The decisions, in the owner's words
where they were choices between options:

| # | Decision | Chosen |
|---|---|---|
| D1 | Scope of the first step | Climate and water |
| D2 | What `preserve` means on drained peat | The carbon stock that stays in the ground |
| D3 | Cells without peat | A third state, ***trifft nicht zu***, distinct from *noch nicht modelliert* |
| D4 | Schema | Outcomes carry their inputs and method — ADR-0008 |
| D5 | Habitat value | Categories only; no points scale until an expert reviews a crosswalk |
| D6 | How climate is measured | **Two measures in every scenario**: soil carbon stock *and* annual greenhouse-gas balance |
| D7 | Water under `restore` | ~~An approximation from the same water-balance model~~ — **revised 2026-09-25: not modelled** (§4.2, `water-arcegmo-v2`) |
| D8 | Emission factors | **IPCC 2013 Wetlands Supplement, Tier 1**; the German inventory as a later cross-check |
| D9 | Grassland on peat, drainage depth unknown | **Show the range** between shallow- and deep-drained |

Everything below that is not one of D1–D9 is this document's proposal for implementing them, and
is listed at the end of each subsection as reviewable.

### 4.1 Climate — `peat-climate-ipcc2013-v1`

**Where it applies.** Only to peat soils as mapped by the LBGR *Moorbodenkarte* 2021
(`docs/data/sources.md` §2.9). A cell's **peat share** is the part of its area covered by a
`bodentyp_2021` polygon of a class that carries a peat body:

- `KV1`–`KV3` *Erd- und Mulmniedermoore* and `HN1`–`HN3` *ungenutzte Moore*;
- the covered classes whose lower layer is `KV*` (`YK,GG\KV*`, `YK,GG/KV*`, `GM\KV*`, `GM/KV*`).

*Moorgleye* (`GH`) and *Anmoorgleye* (`GM`), alone or under a mineral cover, are **not modelled**
in v1: whether IPCC's organic-soil factors apply to them has not been checked. A cell with no peat
share and no carbon polygon is **not applicable** (*trifft nicht zu — kein Moorboden laut
LBGR-Moorbodenkarte*).

**Two metrics, in every scenario (D6).**

| Metric | Unit | What it says |
|---|---|---|
| `peat_carbon_stock` | t C/ha (averaged over the whole cell) | How much organic carbon the cell's peat holds, per LBGR `kohlenstoff_2021` (kg C/m² × 10), area-weighted |
| `peat_ghg_balance` | t CO₂-Äq./ha·a (averaged over the whole cell) | The annual greenhouse-gas emission from the peat share under the scenario's water regime; positive = emission |

**Per scenario.**

| Scenario | `peat_carbon_stock` | `peat_ghg_balance` |
|---|---|---|
| `status_quo` | The stock | Drained factors for the current use |
| `preserve` (D2) | The stock, **shown as what is protected** from conversion | **The same drained factors** — preserving drained peat does not stop it emitting, and the screen says so: *"Schutz allein stoppt die Emissionen entwässerter Moore nicht."* |
| `restore` | The stock | Rewetted factors (*Wiedervernässung*) |
| `develop_*` | `not_modelled` | `not_modelled` — construction on peat is a later gate (ADR-0008) |

The stock is the same number in three scenarios on purpose. Its role is to show what is at stake;
the balance shows whether it is being kept. Tier 1 factors describe a steady state, not the years
of transition after rewetting, so **time-to-effect is shown as not modelled**, not as instant.

**Current use** comes from the dominant CLC5 class already read for `pv_land_cover`
(`docs/data/sources.md` §2.2):

| CLC5 | IPCC Tier 1 row (Wetlands Supplement, Ch. 2) | Range (D9) |
|---|---|---|
| 211 *Nicht bewässertes Ackerland* | *Cropland, drained* (Boreal and Temperate) | the 95 % intervals of the factors used |
| 231 *Wiesen und Weiden* | *Grassland, nutrient-rich*, **shallow- to deep-drained** (Temperate) | shallow-drained central value to deep-drained central value; the stored `value` is their midpoint, which exists for sorting and deltas and is **never shown alone** (ADR-0008 §2) |
| anything else | — | `not_modelled` for `peat_ghg_balance`; the stock is still shown |

"Anything else" includes forest, *Sümpfe* and *Torfmoore* on peat. Their Tier 1 rows exist but
have not been read, or (for wet classes) whether they are drained at all is unknown.

**The factors** (all read at the primary source, `docs/data/sources.md` §2.11; printed page numbers):

| Factor | Cropland, drained | Grassland shallow-drained | Grassland deep-drained | Rewetted, nutrient-rich, Temperate |
|---|---|---|---|---|
| CO₂ on site, t CO₂-C/ha·a | 7.9 (6.5–9.4) — T 2.1, p. 2.12 | 3.6 (1.8–5.4) — T 2.1, p. 2.14 | 6.1 (5.0–7.3) — T 2.1, p. 2.13 | 0.50 (−0.71–1.71) — T 3.1, p. 3.12 |
| DOC, t C/ha·a | 0.31 (0.19–0.46), Temperate — T 2.2, p. 2.20 | same | same | 0.24 (0.14–0.36) — T 3.2, p. 3.14 |
| CH₄ from the land, kg CH₄/ha·a | 0 (−2.8–2.8) — T 2.3, p. 2.25 | 39 (−2.9–81) — T 2.3, p. 2.26 | 16 (2.4–29) — T 2.3, p. 2.26 | **216 kg CH₄-C** (0–856) — T 3.3, p. 3.18 |
| CH₄ from ditches, kg CH₄/ha·a, with Frac_ditch | 1165 (335–1995), 0.05 — T 2.4, p. 2.30 | 527 (285–769), 0.05 | 1165 (335–1995), 0.05 | none — ditches count as part of the rewetted site (V3) |
| N₂O, kg N₂O-N/ha·a | 13 (8.2–18) — T 2.5, p. 2.33 | 1.6 (0.56–2.7) — T 2.5, p. 2.34 | 8.2 (4.9–11) — T 2.5, p. 2.34 | negligible under Tier 1 — p. 3.19 |

Conversion to CO₂ equivalents: C → CO₂ × 44/12; CH₄-C → CH₄ × 16/12; N₂O-N → N₂O × 44/28;
CH₄ and N₂O weighted by their **100-year GWP from IPCC AR5**, the basis the German inventory
uses (NIR 2025, Tabelle 386, labelled *"t CO2-Eq. IPCC AR5"*). DOC uses the Supplement's default
drained factor; its footnote allowing a lower value for fens is recorded but not taken.

**Verification (2026-09-24).** Nothing is computed on an unread number (`CLAUDE.md` §5):

- **V1 — closed.** GWP100 **CH₄ 28, N₂O 265**: IPCC AR5 WG1 Table 8.7, p. 714, the values without
  climate–carbon feedback. They are the values the German inventory uses (NID 2025, p. 497:
  *"CH4-Emissionen … mit dem Faktor 28 (GWP 100 des IPCC AR5"*, N₂O *"mit dem Faktor 265"*). Peat
  CH₄ is biogenic, so the higher fossil-methane value (30) does not apply (AR5 Table 8.A.1, note ‡).
- **V2 — closed.** Ditches enter as Ch. 2 **Eq. 2.6** (p. 2.22): (1 − Frac_ditch)·EF_CH4_land +
  Frac_ditch·EF_CH4_ditch, both in kg CH₄/ha·a. DOC is an **off-site** CO₂ term that Eq. 2.2 adds to
  the drained CO₂ total; it is converted from C to CO₂ like the on-site term.
- **V3 — closed.** Tier 1 for rewetted soils has **no ditch term**: *"former ditches are included as
  a part of rewetted sites and not treated separately"* (Ch. 3, p. 3.5). Rewetted CH₄ is given as
  CH₄-C (Eq. 3.8) and converted × 16/12. Table 3.1 flags the rewetted CO₂ factor as not
  significantly different from zero, which its interval (−0.71 to +1.71) already shows.
- **V4 — still open.** No LBGR document on how the carbon stock was computed (depth, bulk density,
  carbon content) has been found. The nearest paper (Fell et al. 2015, *Telma* 45) covers the 2013
  survey, not the stock layer. The stock therefore stays at `medium` confidence at most, and the
  method page says the depth basis is not documented.

**Confidence.** `peat_carbon_stock`: `medium` (a modelled 2021 potential, not a measurement).
`peat_ghg_balance`: `low` everywhere — a Tier 1 default applied to a cell, with land use from
2018 and drainage state unknown.

**Proposals in this subsection, confirmed by the owner on 2026-09-24:** which LBGR classes count as
peat; CLC 211 → cropland and 231 → grassland; the default DOC factor; combining 95 % intervals by
adding their bounds (which overstates the spread, and is chosen because understating it is the
worse error for a public screen); scaling both metrics by peat share so a cell's value is per
hectare of cell. Two implementation details follow from the data rather than from a choice:
LBGR publishes the stock in whole kg/m², so *"< 0,5"* is read as 0.25; and every peat class is
treated as **nutrient-rich** (*Niedermoor*) for the IPCC rows, which is an assumption, not a
per-polygon reading.

**What the first run on the Uckermark shows** (117 191 cells): 27 805 cells contain peat,
6 764 contain *Moor-/Anmoorgley*. 4 878 cells carry a small carbon stock (about 19 t C/ha on
average) on soil the map classes as mineral. There the stock is shown and the balance is
*trifft nicht zu*, because the balance only applies to a peat body.

### 4.2 Soil and water — `water-arcegmo-v2`

**Source.** LfU Brandenburg, *Wasserhaushaltsgrößen auf Elementarflächenbasis, Reihe 1991–2020*
(ArcEGMO-PSCN; `docs/data/sources.md` §2.10). Complete coverage of Brandenburg, 1 157 871
*Elementarflächen*, usable at 1:10 000 or smaller.

| Metric | Field | Unit |
|---|---|---|
| `percolation` | `GWN_91_20` — *mittlere Jahressumme der Versickerungsmenge* | mm/a |
| `root_zone_soil_moisture` | `NFK_91_20` — *mittlere relative Bodenfeuchte in der Wurzelzone bis 150 cm* | %nFK |

Both are **area-weighted** over the *Elementarflächen* a cell overlaps.

`percolation` is **not** groundwater recharge in the strict sense, and the screen does not call it
that (`docs/data/sources.md` §2.10).

| Scenario | Value |
|---|---|
| `status_quo` | The model's 1991–2020 means for today's land use |
| `preserve` | **The same values.** Leaving the land as it is does not change its water balance, and the screen says so rather than inventing a difference |
| `restore` (D7, revised) | **`not_modelled`.** Rewetting changes the water balance, but the state model has no run for it, and the v1 approximation (below) was withdrawn |
| `develop_*` | `not_modelled` |

Confidence: `medium` for status quo and preserve.

**Direction is not stated.** Neither more percolation nor more root-zone moisture is "better" in
general. On rewetted peat, more water held at the surface can mean *less* percolation. Deltas are
therefore shown **without gain/loss colouring**. This is this document's proposal, following
`CLAUDE.md` §4.5.

**Verification (2026-09-24).**

- **V5 — closed.** `doku_efl20_pscn.pdf` Tab. 2 lists `1110` *feuchte Moore* as the only wet
  peatland class; `1310` *Moor* is listed next to *Heide* without a statement on its water regime,
  and `1112` *Feuchtgrünland* is grassland. Only `1110` is used.
- **V6 — confirmed as proposed:** at least 30 reference areas per hydrotope class.
- **Median, not mean.** A mean can lie outside the quartiles, and ADR-0008 requires the range to
  contain the value.

**Withdrawn: the v1 restore approximation (2026-09-25).** `water-arcegmo-v1` approximated
`restore` wherever §4.1 found peat under CLC 211 or 231. It took the **median** of the
*Elementarflächen* in the pilot region whose land-use class is `1110` *feuchte Moore*, matched on
the cell's dominant hydrotope class (`HYD_NAME`) when that class had at least 30 such areas and on
all of them otherwise, and mixed it with today's value by peat share. The range was the lower to
upper quartile, mixed the same way. The first run showed why it could not carry a public number:
the Uckermark has only **58** *feuchte Moore* areas, 44 of them on `AF` *grundwasserfern* and only
9 on `AN` *grundwassernah*. Their median percolation, **about 145 mm/a**, is more than twice the
average over all cells (about 68 mm/a), so rewetting would have *raised* percolation, which is
more likely an artefact of a small, groundwater-far reference set than what rewetting a drained
fen does. The project owner decided that water under `restore` stays **not modelled**
(`water-arcegmo-v2`). V5 and V6 above record how the reference was checked and stay as the
starting point if a better one is found: a state model run for rewetted conditions, or a larger,
hydrologically matched reference set.

Negative percolation occurs in the model (down to about −255 mm/a), mainly on open water and on
forest and wet land close to groundwater. The documentation does not explain it; it reads as a net
upward water flux, and the value is passed through unchanged.

### 4.3 Nature capital — categories, no score (D5)

No points scale. The *Bundeskompensationsverordnung* (BKompV) Anlage 2 has one (0–24), but it
applies only where federal authorities administer the *Eingriffsregelung* (§ 1 Abs. 1 BKompV).
Brandenburg's own guidance (HVE, 2009) uses a *verbal-argumentative* method with no points, and
no crosswalk from Brandenburg biotope codes to BKompV values has been found. Building one would be
sela's own invention.

What can be shown instead: whether the cell contains a *gesetzlich geschütztes Biotop*, an FFH
habitat type (*Lebensraumtyp*) and its recorded conservation status, from the LfU
*Biotopkataster*. These are facts about the land, not a score.

**Implemented 2026-09-28 (roadmap Step 4, `docs/domain/decision-memo-habitat.md`, under the
owner's delegation, pending confirmation).** Source `docs/data/sources.md` §2.12; rules in
`lib/scoring/habitat.ts`:

- Areas, lines and points of the Kataster, per cell; area biotopes under 1 % of the cell are not
  listed.
- Shown in the Kataster's own words: the protection text where it records a biotope as protected
  (codes `1`, `2`), the habitat type and its *Erhaltungsgrad* (labels from the WFS field
  `ffhges_t`), the mapping year and method, and "nicht im Gelände überprüft" for aerial-only
  records.
- Every surface says the Kataster is selective outside FFH areas and Großschutzgebiete, so a
  missing entry is not evidence of absence.
- As a **quantity**, the dimension stays `not_modelled`; the categories sit beside the comparison
  table, never in it.
- **Not used by the PV classification** (decision H4). 16 519 cells classed *ohne Einschränkung*
  or *eingeschränkt* contain a biotope recorded as protected; whether that becomes a Prüfhinweis
  is left to the owner.

### 4.4 Energy — `pv-yield-v1` (`develop_pv`)

**Implemented 2026-09-28 (roadmap Step 3, `docs/domain/decision-memo-energy-outcome.md`, under
the owner's delegation, pending confirmation).** Code: `lib/scoring/energy/pv-yield.ts`.

| Metric | Unit | What it says |
|---|---|---|
| `pv_installed_capacity` | MWp/ha | Capacity of a new ground-mounted plant per hectare: 1 ÷ area per MWp |
| `pv_annual_yield` | MWh/ha·a | GHI × 1.15 (transposition, 20°–25°) × PR 0.85 ÷ 1 kW/m² ÷ 0.88 ha/MWp — the technical yield of a plant built today, before curtailment |

| Factor | Value | Range | Source |
|---|---|---|---|
| Transposition | 1.15 | 1.137–1.157 | Fraunhofer ISE, *Aktuelle Fakten zur PV*, 20.8.2026, p. 37; range PVGIS 5.3 at 53.1° N 13.9° E, 20°/25° |
| Performance ratio | 0.85 | 0.80–0.90 | Same, p. 39 |
| Area per capacity | 0.88 ha/MWp | 0.83–1.0 | ZSW, *Flächeninanspruchnahme von PV-Freiflächenanlagen – Update 2024*, 02.06.2025, pp. 3, 8 |
| PR definition | Yf = PR × H_POA / G_STC | — | IEA-PVPS T13-28:2024 §2.1.2, p. 14 |

| Scenario | Both metrics |
|---|---|
| `develop_pv` | Modelled where the PV class is *ohne Einschränkung* or *eingeschränkt*; ***trifft nicht zu*** where it is *ausgeschlossen* or *nicht vorgesehen*; yield not modelled without an irradiation value |
| `develop_agripv`, `develop_wind` | `not_modelled` — no cited density or yield |
| `status_quo`, `preserve`, `restore` | ***trifft nicht zu*** — no new plant in this scenario |

Confidence `low` everywhere. The range combines the factors' bounds in the direction that widens
it and is always shown. **It does not rank Uckermark cells:** central values span 3.3 %, and every
cell's range contains the region's best central value.

## 5. What closes this document

1. Each `open` weight is set through the `CLAUDE.md` §3 confirmation gate, technology by
   technology — not as one bulk decision, since "PV vs. agri-PV vs. wind" have genuinely different
   stakeholders and evidence bases (`mvp.md` §2).
2. Each `not yet identified` source is either found and added to `docs/data/sources.md` with a
   verified licence position, or the criterion is marked out of scope for `0.2.1` rather than left
   indefinitely open.
3. Once both close for a given criterion, its `criterion_definition` row is written by a migration,
   not by hand in production — the row's existence is itself part of the reviewable history of
   "what does sela currently claim."

## 6. Illustrative definitions on real data — `illustrative-real-v0` (2026-09-23)

**What was decided.** On 2026-09-23 the project owner chose, through the `CLAUDE.md` §3 gate, to
run the scoring engine on the real Uckermark data with **illustrative** weights — rather than show
measured values only (the alternative put to them). This section records exactly what that run
uses, so the choice is reviewable. **It does not close §5**: every weight above stays *open*.

What is real and what is not:

- **Real:** every `criterion_value` — sourced, dated, attributed, with a per-criterion confidence.
- **Placeholder:** every weight (1.0 each), the normalisation bounds, the land-cover score table,
  the constraint threshold, and the suitability threshold (0.5). They live in
  `lib/scoring/illustrative-weights.ts` and `ingest/real/seed_real_criteria.sql`, and every screen
  that shows a verdict carries the *ILLUSTRATIV* banner naming this.

| id | Applies to | Value read | Illustrative reading | Confidence |
|---|---|---|---|---|
| `pv_irradiation_annual` | pv, agripv | Mean of the 2016–2025 DWD grids at the cell centre (1 km) | linear, 1 000 → 0, 1 300 kWh/m²·a → 1 | medium |
| `pv_land_cover` | pv, agripv | The CLC5 class covering most of the cell | score per class, e.g. 211 arable → 1, 231 grassland → 0.7, forest, settlement, wetland, water → 0 | medium where the class covers ≥ half the cell, otherwise low |
| `pv_slope` | pv, agripv | `gdaldem slope` of DGM200 at the cell centre (200 m) | linear, 0° → 1, ≥ 10° → 0 | low |
| `pv_protection_status` | pv, agripv | Share of the cell inside a Naturschutzgebiet or the Nationalpark | **hard constraint**, violated at a share ≥ 0.5 | medium |
| `wind_protection_status` | wind | Same share | same | medium |

**Decided 2026-09-27 and implemented as `illustrative-real-v1`** (see the subsection below). The
four choices below were placeholders; the project owner has decided each through the
`CLAUDE.md` §3 gate (`docs/domain/decision-memo-scoring-rules.md`, with measured effects):

- **Protection:** NSG and Nationalpark exclude; FFH, SPA and LSG are shown as a named, cited
  flag, not an exclusion (memo Q1c).
- **Cell share:** a cell is excluded at a protected share ≥ 0.5; a smaller overlap is flagged
  with its share (Q2d).
- **Land cover:** three tiers — *vorgesehen* / *eingeschränkt* / *nicht vorgesehen* — each class
  with a written reason; the class assignment is still to be proposed and confirmed (Q3b).
- **Irradiation bounds:** the measured national p1–p99 of the DWD 2016–2025 mean,
  1 050.5–1 257.1 kWh/m²·a; never regional bounds (Q4b).

They took effect under a new `method_version`, `illustrative-real-v1`. The placeholders of
`illustrative-real-v0`, as originally recorded:

1. **Only NSG and Nationalpark exclude.** FFH and SPA areas (Natura 2000) are loaded but do not
   exclude: counting them excluded 53 % of the Landkreis, and Natura 2000 requires a
   *Verträglichkeitsprüfung*, not a ban. With NSG and Nationalpark only, 15.7 % is excluded.
   LSG and the Biosphärenreservat do not exclude either.
2. **"Half the cell" as the exclusion line.** A protected area's ordinance applies to all of its
   area, not by share; a 100 m cell half inside an NSG is a statement about the grid, not about law.
3. **The land-cover score table** — invented for the demo, and the most value-laden of the
   placeholders (it encodes "arable land is where PV goes").
4. **Irradiation bounds 1 000–1 300 kWh/m²·a.** They span German values nationally, but the
   Uckermark varies only between 1 100 and 1 137, so irradiation becomes the "limiting" criterion
   almost everywhere. That is an artefact of the bounds, not a finding about the region.

### 6.1 `illustrative-real-v1` — the Step 1 rules (2026-09-27)

What the engine runs now (`lib/scoring/pv-rules.ts`, rendered on the method page from the same
module; verdicts materialised as `0.3.1-dev`; ADR-0009). Decisions: memo Q1–Q5 and its
*Follow-up decisions* F1–F6.

**In this order, for PV and agri-PV:**

1. **ausgeschlossen** — `pv_protection_status` ≥ 0.5: at least half the cell inside a
   Naturschutzgebiet or the Nationalpark, per the LfU overview data (Q1c, Q2d).
2. **nicht vorgesehen** — `pv_land_cover`, now a **category criterion** (`is_category`, weight 0),
   places the dominant CLC class in the tier *nicht vorgesehen* (F2, F3). No score.
3. **scored** — equal-weight mean of `pv_irradiation_annual` (linear on the national p1–p99,
   1 050.5–1 257.1 kWh/m²·a, Q4b) and `pv_slope` (0–10°, **still a placeholder**); *geeignet* at
   ≥ 0.5 (**placeholder**). A cell of the tier *eingeschränkt* is scored and shows the tier and its
   reason beside the verdict.

**Limiting criterion (Q5, F4):** the scored criterion with the largest weight × gap, where gap =
(best normalised value of that criterion among the region's scored cells for the same technology)
− (this cell's value), named only if gap ≥ 0.1; otherwise none is named.

**Irradiation's national position (Q4b):** shown beside the value by quartile of the same national
distribution (p25 1 101.6, p50 1 137.2, p75 1 187.8 kWh/m²·a).

**Prüfhinweise (Q1c, Q2d, F5, F6):** from `protection_overlap`, per named area with its share ≥ 1 %
of the cell: FFH and SPA → *Verträglichkeitsprüfung erforderlich* (§ 34 BNatSchG); LSG →
*Schutzgebietsverordnung prüfen* (§ 26 BNatSchG); NSG or Nationalpark on a cell that is not
excluded → *teilweise im …* with its share (§ 23 / § 24 BNatSchG). Biosphärenreservat: stored,
not shown (§ 25 not read at source). Every text names "Übersichtsdaten des LfU" and no permission
outcome.

**Land-cover tiers** (reason per class in `pv-rules.ts` and on the method page):

| Tier | Classes |
|---|---|
| *vorgesehen* | 211 arable; 131 extraction; 132 dumps |
| *eingeschränkt* | 231 meadows and pastures; 221, 222 permanent crops; 242, 243 mixed agriculture; 121 industry/commerce; 123 ports; 124 airports; 133 construction sites |
| *nicht vorgesehen* | 111, 112 settlement; 122 road/rail; 141, 142 urban green and leisure; 311–313 forest; 321, 322, 324 semi-natural vegetation; 331–335 open natural surfaces; 411, 412, 421, 423 wetlands; 511–523 water; any undocumented class |

Classes 221, 332, 334, 335, 421, 423, 521, 522 and 523 do not occur in the Uckermark and were
assigned by analogy — to be confirmed before a second region is added.

**Measured on the Uckermark** (`evidence/2026-09-27-scoring-rules/evidence.md` §G): 18 363
*ausgeschlossen*, 27 251 *nicht vorgesehen*, 71 154 *geeignet*, 423 *ungeeignet*.

**Still open (Step 2 and beyond):** every weight, the slope bounds, the threshold — and whether a
binary threshold is the right presentation at all, now that 99.4 % of scored cells pass it.

### 6.2 `real-pv-v1` — the first confirmed PV method (2026-09-28)

Roadmap Step 2; decided by the project owner through the `CLAUDE.md` §3 gate
(`docs/domain/decision-memo-pv-method.md` D1–D5; ADR-0009 amendment 1; verdicts `0.3.2-dev`).

**No weights, no threshold, no score for real regions.** The measurements showed that the
unsuitable share moves between 0 % and 100 % with plausible weights, slope bounds and thresholds,
and no source supports citable values for them (memo §1–§2). Instead each criterion is shown in
its own class, never combined:

| Criterion | Class | Enters the cell's class? |
|---|---|---|
| `pv_protection_status` | *ausgeschlossen* at a share ≥ 0.5 (§6.1) | yes, first |
| `pv_land_cover` | tier → *nicht vorgesehen* / *eingeschränkt* / *ohne Einschränkung* (§6.1) | yes |
| `pv_irradiation_annual` | national quartile of the DWD 2016–2025 mean (§6.1) | no — shown beside it |
| `pv_slope` | none: measured value, confidence `low` (DGM200 flattens slopes; Brandenburg names no limit) | no — shown beside it |

Irradiation and slope carry `weight = 0` in `criterion_definition`: measured, not scored. The
Prüfhinweise (§6.1) are counted per cell and drawn as a contour on the map.

**Uckermark:** *ohne Einschränkung* 59 438, *eingeschränkt* 12 139, *nicht vorgesehen* 27 251,
*ausgeschlossen* 18 363 (`evidence/2026-09-28-pv-method/c_verdicts_real_pv_v1.out`).

**What is still open for PV:** the energy outcome (Step 3); grid connection (U3); a finer DGM
before slope can be classed; the criteria without a source (`pv_designated_corridor`,
`pv_parcel_contiguity`, `pv_aspect`). The fixture's illustrative weights (§6) are unaffected.

**Consequences stated in the interface rather than hidden:**

- **Agri-PV equals PV.** No agri-PV-specific criterion has a source (§2), so the two verdicts
  coincide; the explorer says so when Agri-PV is selected.
- **Wind is never scored,** only excluded — `wind_resource_hub_height` has no source. Outside a
  protected area a wind verdict is *nicht bewertet*.
- **No outcome rows.** `preserve`/`restore` indicators are U2, and the illustrative outcome
  generator is not run for real regions (`ingest/07_materialize_scores.ts --outcomes=none`), so the
  comparison shows *noch nicht modelliert* instead of invented gains.
