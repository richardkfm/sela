# `ingest/real/` — the real pilot-region pipeline

Invoked by `ingest/run.sh` (no flags) after the fetch step, for the pilot region in
`PILOT_REGION` (default `uckermark-12073`, Landkreis Uckermark). Every script is re-runnable
and reads only what `01_fetch.sh` put in `data/raw/`, so the pipeline runs offline once fetched.

| Step | Script | Produces |
|---|---|---|
| 10 | `10_boundary.sh` | `staging.pilot_boundary` from `ingest/pilot/uckermark-12073.geojson` (full precision, EPSG:25832) |
| — | `../04_generate_grid.sql` | the 100 m hex grid (ADR-0001), ≈ 118 600 cells |
| 11 | `11_clc5.sh` | `staging.clc5` — CLC5 2018 polygons inside the region's extent |
| 12 | `12_dwd.sh` | `staging.dwd_radiation` — the ten annual grids of the decided window, one raster per year, native EPSG:31467 |
| 13 | `13_dgm200.sh` | `staging.dgm200_slope` — slope in degrees, derived with `gdaldem slope` from DGM200 |
| 14 | `14_protection.sh` | `staging.protection` — LfU Brandenburg protected areas, one row per area, with its category |
| 20 | `20_sample.sql` | one `staging.raw_sample` row per cell and criterion |
| 21 | `21_write_values.sql` | `criterion_value` rows with per-criterion confidence |

Criterion and source rows are seeded by `seed_real_criteria.sql` (definitions, **illustrative
weights** — see its header) and `../seed_real_sources.sql` (sources and their *Quellenvermerke*).

**Why the irradiation mean is taken per cell rather than per raster.** The decided criterion is
the 2016–2025 trailing mean (`docs/data/sources.md` §5.2). Averaging ten nearest-neighbour samples
at a cell's centre is arithmetically the same as sampling one averaged raster, and it keeps every
year's value in the database — so the interannual spread can be shown next to the mean instead of
being thrown away. It also keeps each grid in its native Gauß-Krüger projection: nothing is
resampled before it is read.
