# `ingest/regions/`

**Real data, unlike `ingest/fixtures/`.** This directory holds the region boundaries the hex grid is
clipped to (ADR-0001, ADR-0012): the polygon `04_generate_grid.sql` reads for a region.

## The regions

| Region id | What | AGS | Area | Hex cells (≈) | File |
|---|---|---|---|---|---|
| `brandenburg-12` | Land Brandenburg | `12` | **29 697 km²** | 1.1 million | `brandenburg-12.geojson` (1.4 MB) |
| `sachsen-14` | Freistaat Sachsen | `14` | **18 478 km²** | 0.7 million | `sachsen-14.geojson` (2.0 MB) |
| `uckermark-12073` | Landkreis Uckermark, Brandenburg — the region sela shipped first | `12073` | **3 082.4 km²** | 118 600 before edge cells are dropped; 117 191 after | `uckermark-12073.geojson` (291 KB) |

Areas are computed from the boundaries themselves (planar, EPSG:25832). Every other Landkreis of
the two Länder (31 in all, listed in `docs/product/roadmap-planning-tool.md`) can be ingested by
id — `REGION=goerlitz-14626 ingest/run.sh` — and `10_boundary.sh` then cuts its boundary from the
fetched VG25 archive with `02b_extract_pilot_boundary.sh`, the script that produced the files here.
A Landkreis of a Land that is already ingested needs no grid of its own: it is a view over the
Land's cells by AGS (ADR-0012).

| | |
|---|---|
| Source | BKG **VG25** (*Verwaltungsgebiete 1:25 000*), layers `vg25_lan` and `vg25_krs`, Produktstand **31.12.2025** |
| Licence | **CC BY 4.0** — read from `nutzungsbedingungen_vg25.pdf` inside the archive itself |
| Geometry | MultiPolygon, EPSG:25832, coordinates rounded to 0.01 m (VG25 is a 1:25 000 product; further digits would be false precision) |

### Required attribution

VG25 is CC BY 4.0, **not** `dl-de/by-2-0` like BKG's CLC5 — the two products differ and the notices
are not interchangeable. Wherever a boundary reaches a screen or an export:

```
© BKG (<Jahr des letzten Datenbezugs>) CC BY 4.0, Datenquellen:
https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf
```

On a web page, "BKG" links to `https://www.bkg.bund.de` and "CC BY 4.0" to
`https://creativecommons.org/licenses/by/4.0`. See `docs/data/sources.md` §3. The explorer draws
the boundary from the `region` row the ingest wrote (`/api/region/[id]/outline`), with this
notice carried in the response.

## Why the boundaries are committed

They are derived data, committed so the pipeline can run without the 325 MB VG25 fetch, and because
a boundary is the one input you never want silently regenerated differently. They are stored
**minified, on one line**, on purpose: pretty-printed the Uckermark alone is 50 965 lines, and every
change would bury a reviewer in diff noise for a file no human reads by eye. One line means the diff
says "the boundary changed", which is the only thing worth reading about it. Pipe a file through
`jq .` to inspect it.

Regenerate one, or cut another region, with:

```sh
./ingest/01_fetch.sh bkg-vg25                    # once — 325 MB
./ingest/02b_extract_pilot_boundary.sh 12 brandenburg
./ingest/02b_extract_pilot_boundary.sh 12073 uckermark
```

## Verified 2026-10-10

`02b_extract_pilot_boundary.sh` had never been run before (the Uckermark file was produced by a
one-off reader in 2026-09). Run for the first time, it wrote a **null geometry**: OGR's SQL dialect
drops a GeoPackage's geometry column when the field list does not name it. Corrected (`geom` is
named), its Uckermark output matches the committed file **point for point** (12 733 vertices,
maximum difference 0.00 m), which closes that open item. The two Land files were produced by the
corrected script.
