# Scoring criteria catalogue

**Version band:** `0.2.x` · **Status:** skeleton — weights open · **Last updated:** 2026-08-22

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
| `pv_irradiation_annual` | Annual solar irradiation / Jährliche Sonneneinstrahlung | `higher_better` | No | open | DWD CDC radiation grids — **blocked**, licence unconfirmed (`docs/data/sources.md`) |
| `pv_slope` | Terrain slope / Geländeneigung | `lower_better` | No | open | Not yet identified — candidate: a DEM derivative (e.g. BKG DGM), not yet added to `docs/data/sources.md` |
| `pv_aspect` | Terrain aspect / Hangausrichtung | `non_monotonic` | No | open | Same DEM candidate as above, not yet identified |
| `pv_parcel_contiguity` | Contiguous usable area / Zusammenhängende nutzbare Fläche | `higher_better` | No | open | Derived from `spatial_unit` geometry itself once real parcel/grid geometry exists — no external source needed |
| `pv_land_cover` | Current land-cover class / Aktuelle Bodenbedeckungsklasse | `non_monotonic` | No | open | BKG CORINE Land Cover 5 ha (CLC5) — licence position `to confirm` (`docs/data/sources.md`) |
| `pv_designated_corridor` | Eligible designated corridor (motorway/rail) / Förderfähiger Seitenrandstreifen | `non_monotonic` | No | open | Not yet identified — the EEG/state corridor-eligibility geometry has not been located as a dataset |
| `pv_protection_status` | Protection-area exclusion / Schutzgebietsausschluss | — (exclusion only) | **Yes** | n/a — exclusion, not scored | BfN Schutzgebiete (WFS) — licence position `to confirm` (`docs/data/sources.md`) |

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
| `wind_protection_status` | Protection-area and species-sensitivity exclusion / Schutzgebiets- und Artenschutzausschluss | — (exclusion only) | **Yes** | n/a — exclusion, not scored | BfN Schutzgebiete (WFS) for protection areas — licence position `to confirm`; raptor/bat species-sensitivity layer not yet identified (tracked against U2) |
| `wind_terrain_access` | Terrain and access suitability / Gelände- und Erschließungseignung | `higher_better` | No | open | Same DEM candidate as `pv_slope`, not yet identified |

**Excluded from this catalogue, not silently assumed:** grid-connection proximity, same basis as
§1 (U3).

## 4. Status quo, preserve, restore — outcome-side, not suitability-side

`status_quo`, `preserve`, and `restore` are not scored for *suitability* (`suitability_verdict`
only applies to `develop_*`) — they produce `outcome` rows directly, across the six shared
dimensions (`mvp.md` §8.3). Which criteria feed each outcome dimension for these three scenarios
is **U2** (nature-capital indicators) and is intentionally not catalogued here yet: `mvp.md` §8.3
rule 2 requires these to be quantified, not residual, and per `CLAUDE.md` §5 no indicator is
listed until it is citable to an established method (e.g. *Biotopwertverfahren*, if adopted). Until
then, every `preserve`/`restore` outcome row a real pipeline would produce is `status =
'not_modelled'` — the schema's first-class state for exactly this situation, not a gap this
document should paper over with an invented weight.

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
