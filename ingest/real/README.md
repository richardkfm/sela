# `ingest/real/` — the real region pipeline

Invoked by `ingest/run.sh` (no flags) after the fetch step, for the region in `REGION`
(default `uckermark-12073`, Landkreis Uckermark; `brandenburg-12` and `sachsen-14` for a whole
Land; `PILOT_REGION` is the older name — ADR-0012). Every script is re-runnable and reads only
what `01_fetch.sh` put in `data/raw/`, so the pipeline runs offline once fetched. The Land's own
sources follow from the region's AGS: Brandenburg (12) reads the LfU, LBGR and Biotopkataster
steps; Sachsen (14) reads the LfULG protected areas and skips peat, water and habitat with a note
(`docs/data/sources.md` §2.14).

| Step | Script | Produces |
|---|---|---|
| 10 | `10_boundary.sh` | `staging.pilot_boundary` from `ingest/regions/<region>.geojson` (full precision, EPSG:25832), or cut from the VG25 archive for a Landkreis without a committed file |
| — | `../04_generate_grid.sql` | the 100 m hex grid (ADR-0001), ≈ 118 600 cells for the Uckermark, ≈ 0.7 million for Sachsen, ≈ 1.1 million for Brandenburg |
| 11 | `11_clc5.sh` | `staging.clc5` — CLC5 2018 polygons inside the region's extent |
| 12 | `12_dwd.sh` | `staging.dwd_radiation` — the ten annual grids of the decided window, one raster per year, native EPSG:31467 |
| 13 | `13_dgm200.sh` | `staging.dgm200_slope` — slope in degrees, derived with `gdaldem slope` from DGM200 |
| 14 | `14_protection.sh` | `staging.protection` — the Land's protected areas, one row per area, with its category: LfU Brandenburg (WFS) or LfULG Sachsen (LUIS downloads), by the region's AGS |
| 15 | `15_moorkarte.sh` | `staging.peat_soil`, `staging.peat_carbon` — LBGR *Moorbodenkarte* 2021 soil classes and carbon stock (Brandenburg only) |
| 16 | `16_wasserhaushalt.sh` | `staging.water_balance` — LfU ArcEGMO *Elementarflächen* inside the region's extent (Brandenburg only) |
| 17 | `17_municipalities.sh` | `municipality` — the region's *Gemeinden* from VG25 `vg25_gem`, by the region's AGS prefix (search, flow F1; ADR-0010). Skipped with a note if the VG25 archive is missing |
| 18 | `18_biotopkataster.sh` | `staging.bbk_fl`, `staging.bbk_li`, `staging.bbk_pu` — LfU *Biotopkataster* areas, lines and points inside the region's extent, reprojected from EPSG:25833 (Brandenburg only) |
| 19 | `19_regions.sh` | `region` — the region, its Land and every Landkreis of that Land with their VG25 boundaries (ADR-0012), for the explorer's navigation |
| 20 | `20_sample.sql` | one `staging.raw_sample` row per cell and suitability criterion |
| 20b | `20b_sample_nature.sql` | the inputs of the outcome methods: peat share, carbon stock, water balance and the wet-peatland reference (`docs/domain/scoring-criteria.md` §4) |
| 21 | `21_write_values.sql` | `criterion_value` rows with per-criterion confidence |
| 22 | `22_protection_overlap.sql` | `protection_overlap` — every protected area a cell overlaps, by name and share (the evidence behind the *Prüfhinweise*, ADR-0009) |
| 23 | `23_habitat_overlap.sql` | `habitat_overlap` — every mapped biotope a cell overlaps: share, length or presence (nature capital as categories, `docs/domain/decision-memo-habitat.md`; ADR-0010; Brandenburg only) |
| 24 | `24_stamp_ags.sql` | `spatial_unit.ags` — each cell's *Gemeinde* (ADR-0012): Landkreis = `left(ags, 5)`, the prefix a Landkreis view over a Land grid selects by |

Criterion and source rows are seeded by `seed_real_criteria.sql` (definitions, **illustrative
weights** — see its header), `seed_nature_criteria.sql` (the outcome-method inputs, which carry
**no weight** and apply to scenarios, not technologies) and `../seed_real_sources.sql` (sources
and their *Quellenvermerke*).

After the ingest, `pnpm db:materialize -- --region=uckermark-12073` writes the classified
verdicts, the **overview pyramid and per-region counts** (`../08_materialize_overview.sql`, ADR-0012)
and, by default for a real region, the **cited outcome methods** registered in `lib/scoring/nature/`
(ADR-0008): every scenario × metric row under `pv-yield-v1` (energy, `lib/scoring/energy/`),
`peat-climate-ipcc2013-v1` and `water-arcegmo-v2`,
each modelled number linked to its criterion values in `outcome_input`, and the methods with
every factor in `outcome_method`.

**Why the irradiation mean is taken per cell rather than per raster.** The decided criterion is
the 2016–2025 trailing mean (`docs/data/sources.md` §5.2). Averaging ten nearest-neighbour samples
at a cell's centre is arithmetically the same as sampling one averaged raster, and it keeps every
year's value in the database — so the interannual spread can be shown next to the mean instead of
being thrown away. It also keeps each grid in its native Gauß-Krüger projection: nothing is
resampled before it is read.
