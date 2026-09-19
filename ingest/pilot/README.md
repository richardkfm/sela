# `ingest/pilot/`

**Real data, unlike `ingest/fixtures/`.** This directory holds the pilot region's boundary — the
polygon `04_generate_grid.sql` clips the hex grid to (ADR-0001).

## The pilot region

**Landkreis Uckermark, Brandenburg** — AGS `12073`, ARS `12073`, NUTS `DE40I`.

| | |
|---|---|
| Area | **3 082.4 km²** — the largest of Brandenburg's 14 *Landkreise*, computed from the boundary itself (planar, EPSG:25832) |
| Extent | E 782 901 – 863 412, N 5 876 363 – 5 945 186 (EPSG:25832) |
| Geometry | a single polygon, one ring, 12 733 vertices — no exclaves, no holes |
| Hex cells | **≈ 118 600** at `ST_HexagonGrid(100, …)`, before `ST_CoveredBy` drops partially-covered edge cells |
| Source | BKG **VG25** (*Verwaltungsgebiete 1:25 000*), layer `vg25_krs`, Produktstand **31.12.2025** |
| Licence | **CC BY 4.0** — read from `nutzungsbedingungen_vg25.pdf` inside the archive itself |

### Required attribution

VG25 is CC BY 4.0, **not** `dl-de/by-2-0` like BKG's CLC5 — the two products differ and the notices
are not interchangeable. Wherever this boundary reaches a screen or an export:

```
© BKG (<Jahr des letzten Datenbezugs>) CC BY 4.0, Datenquellen:
https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf
```

On a web page, "BKG" links to `https://www.bkg.bund.de` and "CC BY 4.0" to
`https://creativecommons.org/licenses/by/4.0`. See `docs/data/sources.md` §3.

## Why the boundary is committed

`uckermark-12073.geojson` is 291 KB of derived data. It is committed so the pipeline can run
without the 325 MB VG25 fetch, and because a boundary is the one input you never want silently
regenerated differently.

It is stored **minified, on one line**, on purpose: pretty-printed it is 50 965 lines, and every
future change to it would bury a reviewer in diff noise for a file no human reads by eye. One line
means the diff says "the boundary changed", which is the only thing worth reading about it. Pipe it
through `jq .` to inspect.

Regenerate or cut a different *Landkreis* with:

```sh
./ingest/01_fetch.sh bkg-vg25          # once — 325 MB
./ingest/02b_extract_pilot_boundary.sh 12073 uckermark
```

Coordinates are **EPSG:25832**, already ADR-0002's storage CRS, so `02_reproject.sh` is a no-op
here. Values are rounded to 0.01 m; VG25 is a 1:25 000 product and further digits would be false
precision.

## Open

- **The committed file was produced by a one-off reader, not by `02b_extract_pilot_boundary.sh`.**
  GDAL was not available in the session that chose the pilot region, so the GeoPackage was parsed
  directly. The script is the reproducible path and **has not been executed yet** — run it in the
  ingest container and diff the result before relying on either.
- Switching pilot region is one argument to that script plus one config value, as roadmap §2.3
  intends. It is a **scope decision** under `CLAUDE.md` §3, so change it deliberately, not in
  passing.
