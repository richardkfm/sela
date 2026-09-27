# Scoring evidence: Landkreis Uckermark (`uckermark-12073`)

Measured 2026-09-27 on a local rebuild of the real pipeline. Every number below comes from a query or script listed here. Nothing is estimated. The scripts and their outputs sit beside this file: `a_protection.sql`, `b_irradiation.sql`, `c_stored.sql`, `variants.ts`, `de_landcover_slope.sql`, `dwd_mean.awk`, plus `*.out` and `c_variants.json`.

## 0. Environment and provenance

- Installed with `apt-get install postgresql-16 postgresql-16-postgis-3 postgis gdal-bin unzip curl`, and it worked through the proxy. Started the `16/main` cluster, created the role and database `sela/sela` (the role is a local superuser), and added the `postgis` and `postgis_raster` extensions.
- Ran `pnpm install --frozen-lockfile`, then `pnpm db:migrate`, then `sh ingest/run.sh` (real mode, `uckermark-12073`, exit 0), then `pnpm db:materialize -- --pilot-region=uckermark-12073` (exit 0). The materialize step wrote 252,745 verdicts, skipped 98,828 (wind has no scoreable criterion), and covered 117,191 units.
- Fetched: bkg-vg25, bkg-clc5, dwd-cdc-radiation, bkg-dgm200, lfu-bb-schutzgebiete, lbgr-bb-moorbodenkarte and lfu-bb-wasserhaushalt.
- Skipped by the pipeline as gated or not implemented: bfn-schutzgebiete and osm-geofabrik.
- Retrieval timestamps from each `data/raw/*/fetch-provenance.json`, all on 2026-09-27 UTC:

  | Source | Retrieved |
  |---|---|
  | vg25 | 10:19:59Z |
  | clc5 | 10:37:19Z |
  | dwd | 10:38:16Z |
  | dgm200 | 10:38:25Z |
  | lfu-schutzgebiete | 10:38:48Z |
  | moorbodenkarte | 10:40:21Z |
  | wasserhaushalt | 10:40:42Z |

- DWD grids used: `grids_germany_annual_radiation_global_{2016..2025}.zip`, from `opendata.dwd.de/.../annual/radiation_global/`.
  - Upstream Last-Modified runs from 30 Mar 2020 for 2016–2019 to 15 Jan 2026 for 2025. The sha256 hashes are in the provenance file.
  - Every grid is `Datensatz_Version=V003`, NCOLS 654, NROWS 866, XLLCORNER 3280500, YLLCORNER 5237500, CELLSIZE 1000, NODATA −999, in kWh/m², on Gauß-Krüger zone 3.
  - The grids are **Germany-wide 1 km grids**, confirmed: 359,586 valid pixels, or 359,586 km².
- Git hygiene: `data/` itself is **not** ignored. Only `data/raw/`, `data/interim/` and `data/processed/` are (`.gitignore` line 51 onwards). Only `data/raw/` was written. `git status` shows only the untracked `docs/product/roadmap-pilot-demo.md`, which was there before this run. No tracked file was changed.
- Everything I created in the local database is in schema `scratch`: `cells`, `prot_sub`, `cell_prot` and `de_mean`.
- Grid facts: 117,191 hex cells, each 25,980.8 m², all fully inside the boundary, totalling 3,044.71 km².
  - The boundary is 3,082.40 km² as a planar EPSG:25832 area, or 3,076.87 km² geodesic.
  - All km² figures below are planar EPSG:25832, which is how the pipeline computes area.

## A. Protection exclusion

`staging.protection` holds whole features from the WFS bbox, not clipped to the Landkreis:

| category | features | Σ feature area km² (unclipped, overlaps summed) | union ∩ Landkreis km² | % of Landkreis |
|---|---|---|---|---|
| nsg | 114 | 715.9 | 490.9 | 15.93 |
| natp (Nationalpark Unteres Odertal) | 1 | 104.8 | 99.8 | 3.24 |
| ffh | 116 | 1,077.3 | 675.2 | 21.91 |
| spa | 7 | 2,505.6 | 1,478.5 | 47.97 |
| lsg | 47 | 2,869.7 | 1,252.4 | 40.63 |
| br (Biosphärenreservat Schorfheide-Chorin) | 1 | 1,294.7 | 598.6 | 19.42 |
| **NSG+NP** union | | | 490.9 | 15.93 |
| FFH+SPA union | | | 1,631.9 | 52.94 |
| **NSG+NP+FFH+SPA** union | | | 1,634.1 | 53.01 |
| any of the 6 | | | 1,938.1 | 62.88 |

- **The Nationalpark polygon lies entirely inside the NSG polygons**: area of natp minus the NSG union is 0.000 km². Adding NP to NSG therefore changes nothing.
- The NSG+NP+FFH+SPA union is only 2.2 km² larger than FFH+SPA alone.

Cell exclusion rules. There are 117,191 cells. km² is cells × 25,980.8 m².

| # | rule | cells excluded | % cells | km² |
|---|---|---|---|---|
| 1 | NSG+NP, share ≥ 0.5 (**current**) | 18,363 | 15.67 | 477.1 |
| 2 | NSG+NP, share > 0 | 21,887 | 18.68 | 568.6 |
| 3 | NSG+NP, centroid inside | 18,391 | 15.69 | 477.8 |
| 4 | NSG+NP+FFH+SPA, share ≥ 0.5 | 62,293 | 53.16 | 1,618.4 |
| 5 | NSG+NP+FFH+SPA, share > 0 | 66,985 | 57.16 | 1,740.3 |

Boundary cells:

| | 0 < share < 0.5 | 0.5 ≤ share < 1 | share = 1 |
|---|---|---|---|
| NSG+NP | **3,524** | **3,264** | 15,099 |
| NSG+NP+FFH+SPA | 4,692 | 6,699 | 55,594 |

"share = 1" means within 1e-9 of 1.

Centroid rule vs share ≥ 0.5 for NSG+NP:

| | share ≥ 0.5 | share < 0.5 |
|---|---|---|
| centroid in | 18,221 | 170 |
| centroid out | 142 | 98,658 |

The two rules disagree on 312 cells.

Sanity check: the NSG+NP share I recomputed matches `staging.raw_sample.pv_protection_status` with max |diff| = 0 over 117,191 cells. Rule 1 equals the stored excluded count of 18,363.

## B. Irradiation (kWh/m²·a, 2016–2025 mean)

| set | n | min | p1 | p5 | p25 | median | p75 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|---|---|
| Uckermark cells (`raw_sample`) | 117,140 | 1,100.4 | — | 1,103.7 | 1,114.4 | 1,122.3 | 1,127.9 | 1,134.8 | — | 1,137.0 |
| Germany, valid pixels | 359,586 | 1,037.2 | 1,050.5 | 1,062.9 | 1,101.6 | 1,137.2 | 1,187.8 | 1,245.4 | 1,257.1 | 1,271.4 |

Uckermark cells:
- 51 cells have no value, because they do not have all ten years at their centre.
- There are 367 distinct values. The 1 km pixels are nearest-neighbour sampled onto 100 m cells.
- `criterion_value` equals `raw_sample` exactly.

Germany pixels:
- The mean is taken per pixel, over pixels where all ten years are ≠ −999.
- Of 566,364 pixels, 359,586 have all 10 years valid, 0 are partially valid and 206,778 are all nodata. The nodata mask is identical in all ten years, so the ten-year requirement drops nothing.

Cross-check: for all 117,140 Uckermark cells, the awk Germany mean at each cell's GK3 pixel equals the pipeline's PostGIS value. 117,140 matched, max |diff| = 0.

Uckermark's position in the Germany distribution:
- 23.9 % of German pixels lie below the Uckermark minimum.
- 39.3 % lie below the Uckermark median.
- 49.9 % lie at or below the Uckermark maximum.
- The whole Landkreis therefore sits between Germany's p24 and p50, and its full range is 36.6 kWh/m².

Under the current bounds of 1000–1300:
- Germany normalises to 0.124–0.905.
- Uckermark normalises to 0.335–0.457. That is arithmetic from the measured min and max, and the shortfalls in C1 confirm it.

Percentiles are `percentile_cont`, which interpolates linearly.

## C. Limiting criterion (technology `pv`)

### Stored `suitability_verdict`

Method version `0.2.1-dev`, bounds 1000–1300.

| verdict | cells | % |
|---|---|---|
| excluded | 18,363 | 15.67 |
| suitable | 72,309 | 61.70 |
| unsuitable | 26,519 | 22.63 |

- All excluded cells are `excluded_by = pv_protection_status`.
- Limiting criterion among the 98,828 scored cells:
  - irradiation: 71,483 (72.33 %)
  - land_cover: 27,318 (27.64 %)
  - slope: 27 (0.03 %)
- Split by verdict:
  - Suitable cells: irradiation 71,483 (98.86 %), land_cover 800, slope 26.
  - Unsuitable cells: land_cover 26,518, slope 1.
- Scores range from 0.240 to 0.991, median 0.753.
- `agripv` gives exactly the same counts as `pv`. `wind` has 18,363 excluded cells and nothing scored.

### Recomputed variants

The recomputation uses the repo's own `computeSuitability` and `illustrativeNormalize`, with only the `pv_irradiation_annual` bounds overridden. C4 removes that definition entirely. Equal weights 1.0, threshold 0.5. The protection rule is the current one, so excluded = 18,363 in every variant. The C1 recompute reproduces the stored verdicts exactly.

| variant | irr. bounds | Uck. irr. normalised | suitable | unsuitable | excluded |
|---|---|---|---|---|---|
| C1 current | 1000–1300 | 0.335–0.457 | 72,309 | 26,519 | 18,363 |
| C2 DE p1–p99 | 1050.5–1257.1 | 0.242–0.419 | 72,010 | 26,818 | 18,363 |
| C3 DE min–max | 1037.2–1271.4 | 0.270–0.426 | 72,054 | 26,774 | 18,363 |
| C4 irradiation removed | — | — | 72,760 | 26,068 | 18,363 |
| C5 Uck. min–max | 1100.4–1137.0 | 0–1 | 81,575 | 17,253 | 18,363 |

Limiting criterion, as verdict:criterion = cells. The shortfall range (min / median / max) is in brackets:

- **C1**
  - suitable: irradiation 71,483 [0.543/0.588/0.665], land_cover 800, slope 26
  - unsuitable: land_cover 26,518, slope 1
- **C2**
  - suitable: irradiation 71,577 [0.581/0.646/0.758], land_cover 410, slope 23
  - unsuitable: land_cover 26,800, irradiation 17, slope 1
- **C3**
  - suitable: irradiation 71,560 [0.574/0.631/0.730], land_cover 470, slope 24
  - unsuitable: land_cover 26,764, irradiation 9, slope 1
- **C4**
  - suitable: slope 59,570 [0.0005/0.078/0.681], land_cover 13,190
  - unsuitable: land_cover 26,068
  - 17,194 of the slope-limited cells have a shortfall below 0.05. They are named "limiting" because of a trivially small slope shortfall.
- **C5**
  - suitable: irradiation 58,829 [0.008/0.424/0.997], land_cover 15,473, slope 7,273
  - unsuitable: land_cover 16,994, irradiation 259
  - **9,056 cells whose land-cover score is 0 (forest, settlement, water or wetland classes) become "suitable"**. Under C1–C4 that count is 0.

Scores (min / median / max):

| variant | min | median | max |
|---|---|---|---|
| C1 | 0.240 | 0.753 | 0.991 |
| C2 | 0.225 | 0.732 | 0.991 |
| C3 | 0.228 | 0.738 | 0.991 |
| C4 | 0.141 | 0.925 | 1.000 |
| C5 | 0.220 | 0.791 | 0.997 |

Read-out: under any Germany-referenced bounds (C1–C3), irradiation is the limiting criterion for roughly 99 % of suitable cells, but the verdict counts move by at most 299 cells. Irradiation acts as a near-constant penalty in the Uckermark rather than as a discriminator. C5 stretches a 36.6 kWh/m² spread to the full 0–1 range, which flips 9,266 cells to suitable, including 9,056 with a land-cover score of 0.

## D. Land cover: dominant CLC5 class per cell

| code | name (clc-classes.ts) | cells | % | mean share of cell |
|---|---|---|---|---|
| 211 | Nicht bewässertes Ackerland | 61,168 | 52.20 | 0.951 |
| 312 | Nadelwälder | 17,363 | 14.82 | 0.900 |
| 231 | Wiesen und Weiden | 13,181 | 11.25 | 0.858 |
| 311 | Laubwälder | 8,047 | 6.87 | 0.832 |
| 512 | Wasserflächen | 3,966 | 3.38 | 0.854 |
| 112 | Nicht durchgängig städtische Prägung | 3,317 | 2.83 | 0.781 |
| 313 | Mischwälder | 3,224 | 2.75 | 0.765 |
| 321 | Natürliches Grünland | 2,217 | 1.89 | 0.860 |
| 121 | Industrie und Gewerbeflächen, öffentliche Einrichtungen | 1,453 | 1.24 | 0.819 |
| 411 | Sümpfe | 1,123 | 0.96 | 0.770 |
| 324 | Wald-Strauch-Übergangsstadien | 630 | 0.54 | 0.712 |
| 322 | Heiden und Moorheiden | 490 | 0.42 | 0.907 |
| 142 | Sport- und Freizeitanlagen | 439 | 0.37 | 0.757 |
| 511 | Gewässerläufe | 165 | 0.14 | 0.622 |
| 141 | Städtische Grünflächen | 78 | 0.07 | 0.734 |
| 131 | Abbauflächen | 73 | 0.06 | 0.818 |
| 132 | Deponien und Abraumhalden | 60 | 0.05 | 0.787 |
| 122 | Straßen-, Eisenbahnnetze und funktionell zugeordnete Flächen | 59 | 0.05 | 0.695 |
| 222 | Obst- und Beerenobstbestände | 40 | 0.03 | 0.785 |
| 111 | Durchgängig städtische Prägung | 31 | 0.03 | 0.730 |
| 124 | Flughäfen | 25 | 0.02 | 0.778 |
| 412 | Torfmoore | 22 | 0.02 | 0.710 |
| 333 | Flächen mit spärlicher Vegetation | 10 | 0.01 | 0.797 |
| 123 | Hafengebiete | 7 | 0.01 | 0.641 |
| 331 | Strände, Dünen und Sandflächen | 3 | 0.00 | 0.922 |

- The dominant class covers **less than half the cell in 1,965 cells (1.68 %)**.
- It covers less than the whole cell (share < 0.999) in 46,774 cells (39.91 %).
- The minimum dominant share is 0.291.

## E. Slope (`pv_slope`, degrees)

Slope comes from `gdaldem slope -compute_edges` on DGM200, read at the cell centre.

| n | min | p50 | p95 | p99 | max | cells > 5° | cells > 10° |
|---|---|---|---|---|---|---|---|
| 117,191 | 0.0002 | 0.699 | 2.413 | 3.538 | 7.187 | 146 (0.125 %) | 0 |

No cell reaches the current illustrative "worst" bound of 10°.

## Commands

```sh
export DATABASE_URL=postgresql://sela:sela@localhost:5432/sela
psql "$DATABASE_URL" -f docs/domain/evidence/2026-09-27-scoring-rules/a_protection.sql      # A
psql "$DATABASE_URL" -f docs/domain/evidence/2026-09-27-scoring-rules/b_irradiation.sql     # B (needs scratch.de_mean, below)
psql "$DATABASE_URL" -f docs/domain/evidence/2026-09-27-scoring-rules/c_stored.sql          # C stored
psql "$DATABASE_URL" -f docs/domain/evidence/2026-09-27-scoring-rules/de_landcover_slope.sql  # D, E
# Germany mean: unzip the 10 zips, strip the header to the data body, then average per pixel
for y in $(seq 2016 2025); do tr -d '\r' < grids_germany_annual_radiation_global_$y.asc | sed -n '/^NODATA_VALUE/,$p' | tail -n +2 > $y.dat; done
awk -f docs/domain/evidence/2026-09-27-scoring-rules/dwd_mean.awk 2016.dat ... 2025.dat     # writes mean_2016_2025.tsv (pixel index, mean), only pixels with 10 valid years
psql "$DATABASE_URL" -c "CREATE TABLE scratch.de_mean (pix int, mean double precision)" -c "\copy scratch.de_mean FROM 'mean_2016_2025.tsv'"
# C variants (from the repo root)
pnpm exec tsx docs/domain/evidence/2026-09-27-scoring-rules/variants.ts '[{"name":"C1","bounds":{"min":1000,"max":1300}},{"name":"C2","bounds":{"min":1050.5,"max":1257.1}},{"name":"C3","bounds":{"min":1037.2,"max":1271.4}},{"name":"C4","dropIrradiation":true},{"name":"C5","bounds":{"min":1100.4,"max":1137}}]'
```

Key SQL, the per-cell share, uses the same method as `20_sample.sql`:

```sql
coalesce((SELECT ST_Area(ST_Intersection(c.geom, ST_Union(p.geom))) / c.area
          FROM scratch.prot_sub p WHERE p.category IN ('nsg','natp'[,'ffh','spa'])
          AND ST_Intersects(c.geom, p.geom)), 0)
-- centroid: EXISTS (SELECT 1 FROM scratch.prot_sub p WHERE p.category IN (...) AND ST_Intersects(ST_Centroid(c.geom), p.geom))
-- Landkreis coverage: ST_Area(ST_Intersection(ST_Union(geom per group), pilot_boundary.geom)) / ST_Area(pilot_boundary.geom)
```

## Caveats

- LfU protection data is overview data. The service says it is not legally binding and was digitised at 1:10,000.
- Areas are planar EPSG:25832. The Uckermark (measured extent 13.24–14.45°E) lies outside UTM zone 32 (6–12°E), which is why the planar and geodesic boundary areas differ by 0.18 %.
- The percentile method is `percentile_cont` (linear interpolation), and in `variants.ts` the shortfall quantiles use nearest-rank.

## F. Follow-up measurements for the Step 1 implementation (same day, fresh rebuild)

A second local rebuild on 2026-09-27 (same pipeline, same sources, 117 191 cells) measured what
the owner's first answers to the implementation questions would do, before the follow-up
questions were put. Script `f_step1_followup.sql`, output `f_step1_followup.out`. Tier assignment
as proposed (211, 131, 132 *vorgesehen*; 231, 221, 222, 242, 243, 121, 123, 124, 133
*eingeschränkt*; every other class *nicht vorgesehen*).

| Tier | NSG/NP-excluded (share ≥ 0.5) | not excluded | total |
|---|---|---|---|
| vorgesehen | 1 863 | 59 438 | 61 301 |
| eingeschränkt | 2 567 | 12 139 | 14 706 |
| nicht vorgesehen | 13 933 | 27 251 | 41 184 |

- **Land cover out of the score, nothing else changed:** score = mean of irradiation (national
  p1–p99) and slope (0–10°); 26 930 of the 27 251 non-excluded *nicht vorgesehen* cells would be
  *geeignet*, and 98.9 % of all non-excluded cells. This is why *nicht vorgesehen* became its own
  verdict (ADR-0009).
- **Regional spread of the normalised values** (non-excluded, tier ≠ *nicht vorgesehen*):
  irradiation p5–p95 0.273–0.409 (max 0.419), slope 0.773–0.989 (max 1.000). Both "vary" by any
  threshold ≤ 0.13.
- **Q5, gap to 1 (as first proposed):** with a shortfall of ≥ 0.1 among varying criteria,
  irradiation stays "limiting" in 71 572 of 71 577 cells — the artefact is not removed.
- **Q5, gap to the region's best value:** unweighted gap ≥ 0.1 names irradiation in 12 210
  cells, slope in 22 973, none in 36 394. (Weighted by ½ each, ≥ 0.05 gives the same split; ≥ 0.1
  weighted gives irradiation 21, slope 5 382, none 66 174.) The owner chose the unweighted gap
  ≥ 0.1.
- **Protected-area overlaps among non-excluded cells** (any share > 0 / share < 1 % / ≥ 50 %):
  FFH 12 321 / 468 / 7 797; SPA 43 067 / 309 / 39 709; LSG 41 871 / 165 / 40 065;
  Biosphärenreservat 17 036 / 62 / 16 560; NSG partial 3 524 / 367 / —. At ≥ 1 %, 58 269 of the
  98 828 non-excluded cells carry at least one Prüfhinweis.

### G. Verdicts as materialised (`0.3.1-dev`, `illustrative-real-v1`)

After implementation, `pnpm db:materialize -- --pilot-region=uckermark-12073`
(`g_step1_verdicts.out`), for `pv` (agri-PV identical; wind: 18 363 excluded, otherwise not scored):

| Verdict | Named criterion | Cells |
|---|---|---|
| ausgeschlossen | `pv_protection_status` | 18 363 |
| nicht vorgesehen | `pv_land_cover` | 27 251 |
| geeignet | `pv_irradiation_annual` | 12 189 |
| geeignet | `pv_slope` | 22 553 |
| geeignet | none | 36 412 |
| ungeeignet | `pv_slope` | 423 |

The split differs from F by a few dozen cells because F's Q5 query ran over cells regardless of
missing values, while the engine skips a criterion a cell has no value for (51 cells lack an
irradiation mean). `protection_overlap`: 191 365 rows (`22_protection_overlap.sql`); NSG
overlaps touch 21 887 cells, matching §A.
