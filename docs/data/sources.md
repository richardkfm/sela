# Data source inventory

**Version band:** `0.3.x` · **Status:** BKG, DWD and LfU Brandenburg **Confirmed, fetched and ingested** for the Uckermark; LBGR *Moorbodenkarte* and LfU ArcEGMO water balance **Confirmed, fetched and ingested** (2026-09-24); BfN and OSM still gated — see §1 · **Last updated:** 2026-09-24

This is the gate `docs/architecture/roadmap-to-first-deployment.md` §2.2 and §3.1 requires before
any dataset enters ingestion: `CLAUDE.md` §5 forbids asserting a licence that has not been
verified, and no dataset below may be used in real ingestion until its **Status** column says so.

Nothing in this table states a coverage, resolution, or licence beyond what has actually been
read at the source cited. Where that has not happened, the row says so.

---

## 1. Status at a glance

| Dataset | Licence | Derived outputs publishable? | Ingest gate |
|---|---|---|---|
| BfN Schutzgebiete | GeoNutzV | **Yes**, with attribution + change notice | **Licence cleared; access blocked** — `geodienste.bfn.de` returns 403 to this environment (§6). **Substituted for the Brandenburg pilot** by the LfU service below (§2.8) |
| BKG CORINE Land Cover 5 ha (CLC5-2018) | `dl-de/by-2-0` | **Yes**, with attribution + change notice | **Confirmed** — pinned artefact fetched and checksummed 2026-09-19 (§2.2, §6) |
| DWD CDC annual global radiation grids | CC BY 4.0 | **Yes**, with attribution + change notice | **Confirmed** — full 1991–2025 series fetched and checksummed 2026-09-19 (§2.3, §6) |
| BKG Verwaltungsgebiete 1:25 000 (VG25) | **CC BY 4.0** | **Yes**, with attribution + change notice | **Confirmed** — fetched and checksummed 2026-09-19; supplies the pilot boundary (§2.5) |
| OpenStreetMap via Geofabrik | ODbL 1.0 | Yes, but share-alike would attach to sela's own database | **Withdrawn (ADR-0005, 2026-09-19).** Not unconfirmed — deliberately not used. §4 |
| BKG basemap.de Web Raster | **CC BY 4.0** | **Yes**, with attribution + change notice | **In use** — the basemap, per ADR-0005 (§4.1) |
| BKG basemap.de 3D Gelände (DGM5 terrain-RGB) | **basemap.de 3D-Beta Dienste** — *not* CC BY 4.0 | **Display only**, through the service, "zu Testzwecken"; no storage, no derived data | **In use, display only** — terrain in the 3D parcel preview (ADR-0006). **Blocks a public `1.0`** until the beta terms are replaced (U10, §2.6) |
| BKG DGM200 | `dl-de/by-2-0` | **Yes**, with attribution + change notice | **Confirmed and ingested** 2026-09-23 — source of `pv_slope` (§2.7). Still not used as preview terrain (§2.6) |
| LfU Brandenburg Schutzgebiete (WFS-LFU-SCHUTZG) | `dl-de/by-2-0` | **Yes**, with attribution + change notice | **Confirmed and ingested** 2026-09-23 — source of both protection exclusions for the Uckermark (§2.8). *Nicht rechtsverbindlich* |
| LBGR Brandenburg *Moorbodenkarte* (WFS-MBK) | `dl-de/by-2-0` | **Yes**, with attribution + change notice | **Confirmed and ingested** 2026-09-24 — peat soils and carbon stock for the climate outcome (§2.9) |
| LfU Brandenburg *Wasserhaushalt* 1991–2020 (ArcEGMO) | `dl-de/by-2-0` | **Yes**, with attribution, source and data date | **Confirmed and ingested** 2026-09-24 — water balance for the soil-and-water outcome (§2.10). *Keine Rückschlüsse auf liegenschaftsrechtliche Belange* |

**The machine gate stands open for seven rows and closed for two.** `ingest/sources.manifest.json`
— which `ingest/01_fetch.sh` actually reads before touching a network — reads `confirmed` for
`bkg-clc5` and `dwd-cdc-radiation` (2026-09-19), `bkg-vg25` (2026-09-19), and `bkg-dgm200` and
`lfu-bb-schutzgebiete` (2026-09-23), and `lbgr-bb-moorbodenkarte` and `lfu-bb-wasserhaushalt` (2026-09-24, the owner's decision to model climate and water, `docs/domain/scoring-criteria.md` §4); it still reads `to_confirm` for `bfn-schutzgebiete` and
`osm-geofabrik`. The two 2026-09-23 rows were confirmed by the project owner's decision to run the
real Uckermark ingest with slope and a Brandenburg protection source (§2.7, §2.8).

That flip was **not** made by the session that gathered the evidence. It was taken as a
`CLAUDE.md` §3 decision (data sources and licensing) by the project owner on 2026-09-19, on the
explicit basis that the two rows flipped are licence-cleared, version-pinned, and carry no
share-alike term — so nothing about them constrains what sela may publish. The two remaining rows
were held back deliberately: BfN because no extract can be retrieved (§6), OSM because §4 is an
open decision. **This document and the manifest must continue to be changed together**, in the
change that takes any further such decision.

---

## 2. The inventory

### 2.1 BfN Schutzgebiete — protection areas → hard constraints

| | |
|---|---|
| Publisher | Bundesamt für Naturschutz (BfN) |
| Use in sela | `pv_protection_status`, `wind_protection_status` — ADR-0004 exclusions |
| Datasets | *Naturschutzgebiete Deutschland* (dataset dates 2019-12-31, revised 2023-07-04) · *Landschaftsschutzgebiete Deutschland* (2021-12-01, revised 2023-05-25) · *Nationalparke Deutschland* (2021-11-29, revised 2023-07-04) |
| Coverage / geometry | Federal, vector |
| Service endpoints | `geodienste.bfn.de/ogc/wfs/schutzgebiet` (WFS 2.0.0), `geodienste.bfn.de/ogc/wms/schutzgebiet` (WMS 1.3.0) — as named in the datasets' own metadata records |
| Licence | **GeoNutzV** — *Verordnung zur Festlegung der Nutzungsbestimmungen für die Bereitstellung von Geodaten des Bundes* vom 19. März 2013 (BGBl. I S. 547), licence id `geonutz/20130319` |
| Access constraints | "Es gelten keine Zugriffsbeschränkungen" (per the metadata records) |
| Use limitation | **"Nicht für Planungszwecke geeignet."** — carried by every BfN record inspected. See §5. |
| Evidence | GDI-DE catalogue (`gdk.gdi-de.org` CSW), ISO 19139 records published by BfN, fetched 2026-09-18; GeoNutzV full text read at `gesetze-im-internet.de/geonutzv/BJNR054700013.html`, 2026-09-18 |

**Derived outputs — confirmed permitted.** GeoNutzV §2(2) states the provided geodata may in
particular be "vervielfältigt, ausgedruckt, präsentiert, **verändert, bearbeitet sowie an Dritte
übermittelt** werden", "mit eigenen Daten und Daten Anderer zusammengeführt und **zu selbständigen
neuen Datensätzen verbunden** werden", and "in interne und externe Geschäftsprozesse, Produkte und
Anwendungen in öffentlichen und nicht öffentlichen elektronischen Netzwerken eingebunden werden".
A sela `criterion_value` row derived from a protection-area polygon is exactly the middle case: a
self-standing new dataset combining BfN data with sela's own. §2(1) grants this free of charge for
all commercial and non-commercial purposes. The conditions are in §3: source notes must be carried
"erkennbar und in optischem Zusammenhang", and alterations must carry a *Veränderungshinweis* in
that source note. There is **no share-alike clause** — sela's own database is not forced open by
using this data.

This corrects and closes the item the 2026-08-22 session left open: the earlier `dl-de/by-2-0`
label on this row was an assumption, GeoNutzV is the actual basis, and GeoNutzV's operative
paragraphs have now been read rather than inferred from the ordinance's table of contents.

**What is still blocking ingest:** not the licence. `geodienste.bfn.de` returns HTTP 403 to this
environment on every path tried, including the exact GetCapabilities request that succeeded on
2026-08-22 (§6). The retrieval date and the exact served version therefore cannot be pinned from
here, and the *Quellenvermerk* that GeoNutzV §3 requires should be re-read off the live
capabilities document before a real ingest run — the template recorded in §3 of this document is
BfN's generic one, taken from the metadata records rather than from the service itself.

### 2.2 BKG CORINE Land Cover 5 ha (CLC5-2018) — land cover, `status_quo` baseline

| | |
|---|---|
| Publisher | Bundesamt für Kartographie und Geodäsie (BKG), Geodatenzentrum |
| Use in sela | `pv_land_cover`; current-use input to the `status_quo` baseline |
| Version / vintage | CLC5, Stand 2018. Derived from *Landbedeckungsmodell Deutschland 2018* (LBM-DE2018) **in its revised 2021 version**, minimum object size 1 ha, generalized to a 5 ha minimum area for CLC5 |
| Coverage / geometry | Federal, **vector** (CLC nomenclature; LB/LN classes with *Versiegelungs-* and *Vegetationsanteil*) |
| Retrieved artefact | `https://daten.gdz.bkg.bund.de/produkte/dlm/clc5_2018/aktuell/clc5_2018.utm32s.shape.zip` — **fetched in full 2026-09-19**: 1 361 366 128 bytes (exactly the size pinned by HEAD on 2026-09-18), `Last-Modified: Fri, 25 Mar 2022 13:15:09 GMT`, sha256 `98a6f2329e62b066e270ef019b7e29f6a0d6b693aca270e74e5f26e0aea71ac0`, archive integrity verified (`unzip -t`, no errors). GK3 and TM32 variants exist at the same path; **UTM32S is the one to take.** |
| Documentation | `https://sgx.geodatenzentrum.de/web_public/gdz/dokumentation/deu/clc5_2018.pdf` |
| Licence | **`dl-de/by-2-0`** (Datenlizenz Deutschland – Namensnennung – Version 2.0), stated on BKG's own product page; price "kostenfrei", category "Open Data" |
| Evidence | BKG product page `gdz.bkg.bund.de/index.php/default/corine-land-cover-5-ha-stand-2018-clc5-2018.html` and canonical licence text at `govdata.de/dl-de/by-2-0`, both fetched and read 2026-09-18 |

**Derived outputs — confirmed permitted.** The canonical `dl-de/by-2-0` text (§1) permits the data
to be "vervielfältigt, ausgedruckt, präsentiert, verändert, bearbeitet sowie an Dritte übermittelt"
and "mit eigenen Daten und Daten Anderer zusammengeführt und **zu selbständigen neuen Datensätzen
verbunden**", for commercial and non-commercial use alike. Conditions: the source note of §1(2)
(provider, licence label with a link to the licence text, and a reference to the dataset URI) and
the change notice of §1(3). No share-alike.

**2018 vintage remains a stated data-currency limitation**, now with a second dimension recorded:
the underlying LBM-DE2018 was itself revised in 2021, and the published artefact was last modified
in March 2022. Land cover is the input most likely to be out of date against the ground.

**Verified from inside the archive, 2026-09-19** — three things that were previously read off a
product page or a filename and are now read off the data itself:

- **No reprojection is needed, confirmed from the data.** Every layer's `.prj` reads
  `PROJCS["ETRS_1989_UTM_Zone_32N", … SPHEROID["GRS_1980" …]]` — ETRS89 / UTM zone 32N, which is
  ADR-0002's EPSG:25832 storage CRS. `ingest/02_reproject.sh` is a no-op for this source. (Contrast
  §2.3, where DWD arrives in EPSG:31467 and must be warped.)
- **`aktualitaet.txt`** states *"Referenzjahr 2018 (Vegetationsperiode) / nach grundlegender
  Neubearbeitung am BKG / in Vertrieb ab: 08/2021"* — corroborating the 2021 revision of the
  underlying model from the publisher's own file rather than from a web page.
- **The archive ships BKG's own `quellenvermerk_datenlizenz_deutschland.txt`**, which is the
  authoritative form of the attribution — see §3.

Layer structure: the shapefiles are split by CLC class group —
`clc5_class1xx` (774 686 944 byte `.shp`), `class2xx` (2 061 879 512), `class3xx` (1 852 493 264),
`class4xx` (29 002 248) and `class5xx` (73 889 008) — five layers, matching the CLC nomenclature's
top-level divisions. **`clc5_class1xx` is the one that carries CLC 111/112**, which matters for
§4.1: the settlement-geometry option needs that single layer, not the whole model.

### 2.3 DWD CDC annual global radiation grids — solar irradiation

| | |
|---|---|
| Publisher | Deutscher Wetterdienst, Climate Data Center (CDC) |
| Use in sela | `pv_irradiation_annual` (PV and agri-PV) |
| Dataset | "Gridded annual sum of incoming shortwave radiation (global radiation) on the horizontal plain for Germany based on ground and satellite measurements", **Version V003** |
| Coverage / resolution | Germany; **1 km × 1 km**, yearly, 1991 – last year. Grid 654 columns × 866 rows, `NODATA_VALUE = -999` |
| Units | Annual sum of global radiation in **kWh/m²** |
| Projection | **EPSG:31467** — Gauß-Krüger zone 3, Bessel ellipsoid, Potsdam datum. **Reprojection to EPSG:25832 is required** at ingest (`ingest/02_reproject.sh`); this is not a dataset that arrives in sela's storage CRS. |
| Format | Esri ASCII raster, preceded by a 22-line header section |
| Stated uncertainty | Mean uncertainty **±6 %**, from a uniform method developed in an EU project (European Solar Radiation Atlas, 2000) with DWD's own follow-up studies |
| Retrieved artefacts | `https://opendata.dwd.de/climate_environment/CDC/grids_germany/annual/radiation_global/` — **the complete published series, 1991–2025, fetched 2026-09-19**: 35 annual `.zip` files plus both description PDFs, 37 artefacts, 7 021 079 bytes total, each with its sha256 and upstream `Last-Modified` recorded in `data/raw/dwd-cdc-radiation/fetch-provenance.json`. The 2025 file is dated 2026-01-15. The directory is extended around February with the previous year, so `lastYear` in `ingest/sources.manifest.json` is a value that ages. |
| Licence | **CC BY 4.0** |
| Evidence | `opendata.dwd.de/climate_environment/CDC/Terms_of_use.pdf` (Status: Mai 2024) and the dataset's own `DESCRIPTION_gridsgermany_annual_radiation_global_en.pdf`, both fetched and read 2026-09-18; `dwd.de/copyright` (redirects to `dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html`) and the *Vorlagen für die Gestaltung des Quellenvermerks* page, read 2026-09-18 |

**Derived outputs — confirmed permitted.** The CDC-OpenData terms of use are a one-page document
that says, in full, that CC BY 4.0 applies. DWD's legal-notices page states independently that all
freely accessible geodata and geodata services may be reused under CC BY 4.0 with a source note,
and that "Geodaten" includes all provided meteorological weather and climate information with a
spatial reference. CC BY 4.0 permits adaptation and redistribution for any purpose, with
attribution and an indication of changes; it has no share-alike term.

This closes the row that `0.2.1` recorded as outright **blocked** with its terms unread: the two
URLs that 404'd in August were the wrong ones, and the correct current terms are unambiguous. The
±6 % figure is a real, citable number for the `criterion_value.confidence` column rather than an
invented one — the first such number this project has.

**Every specification above was re-verified against the delivered files on 2026-09-19**, not only
against the description PDF. Unzipping the annual grids confirms, in the files' own header block:
`Datensatz_Version=V003`, `Werte_Dimension=kWh/m2`, `Werte_keineDaten=-999`,
`Koordinatensystem=Gauss-Krueger 3. Meridianstreifen Potsdam-Datum` (EPSG:31467),
`NCOLS 654`, `NROWS 866`, `CELLSIZE 1000`, `XLLCORNER 3280500`, `YLLCORNER 5237500`. The grid
origin, extent and cell size are **byte-identical across every year sampled** (1991, 2000, 2010,
2020, 2024, 2025), so a multi-year aggregate is a cell-wise arithmetic operation with no
resampling — which matters for §5.2.

**Two ingest hazards found in the delivered files, neither of them documented upstream:**

1. **The 22-line DWD preamble precedes the Esri header.** The file begins `[header]` and reaches
   `NCOLS` only on line 23, after a `[ASCII-Raster-Format]` marker. It is therefore *not* a bare
   Esri ASCII grid, and cannot be handed to `ingest/02_reproject.sh` as-is — a strip step has to
   run first. (That the file is shaped this way is verified; that GDAL's AAIGrid driver rejects it
   in this exact form has **not** been re-tested here, because the GDAL container is not available
   in the environment that fetched the data. Confirm before relying on the workaround.)
2. **`Titel_2` is wrong in the four most recent files.** 1991–2021 carry `Titel_2=Jahressumme`;
   **2022, 2023, 2024 and 2025 carry `Titel_2=Monatssumme`** — "monthly sum" — in a dataset whose
   every file is an annual sum. The values prove the label wrong, not the data: 2025 ranges
   1 092–1 307 kWh/m², which is an annual total for Germany and roughly an order of magnitude above
   any monthly one. **Nothing in the ingest path may read `Titel_2` to determine units or
   accumulation period.** Recorded because the mislabelling is silent and would produce a plausible
   wrong answer rather than an error.

### 2.5 BKG Verwaltungsgebiete 1:25 000 (VG25) — the pilot region boundary

| | |
|---|---|
| Publisher | Bundesamt für Kartographie und Geodäsie (BKG), Geodatenzentrum |
| Use in sela | The pilot-region boundary that `04_generate_grid.sql` clips the hex grid to (ADR-0001). Not a scoring input — it defines *where*, not *what*. |
| Version / vintage | **Produktstand 31.12.2025** (`aktualitaet.txt` in the archive); terms document dated 08.07.2026 |
| Coverage / geometry | Federal, vector, layered by administrative level — `vg25_krs` (*Kreise*) is the one sela reads |
| Retrieved artefact | `https://daten.gdz.bkg.bund.de/produkte/vg/vg25_ebenen/aktuell/vg25.utm32s.gpkg.zip` — **fetched 2026-09-19**, 325 132 397 bytes, `Last-Modified: Fri, 10 Jul 2026 10:18:54 GMT`, sha256 in `data/raw/bkg-vg25/fetch-provenance.json` |
| Projection | **EPSG:25832** — confirmed from the GeoPackage's own `srs_id`, not from the filename. Already ADR-0002's storage CRS; **no reprojection.** |
| Licence | **CC BY 4.0** — *not* `dl-de/by-2-0` |
| Evidence | `nutzungsbedingungen_vg25.pdf`, shipped **inside the archive**, read in full 2026-09-19 |

**Derived outputs — confirmed permitted.** The terms document is one page and unambiguous: the data
is provided free of charge under the *Creative Commons Namensnennung 4.0 International* licence,
and data under CC BY 4.0 may be shared, reproduced and adapted with attribution. No share-alike.

**A caution worth carrying:** this row is the reason `CLAUDE.md` §5 is written the way it is. VG25
sits on the same host, under the same publisher, one directory across from CLC5 — and it is a
**different licence**. The manifest entry for `bkg-vg25` was first written as `dl-de/by-2-0` by
analogy with §2.2 and corrected only after the in-archive terms document was read. Per-product
verification is not ceremony.

**What was extracted.** Landkreis Uckermark, AGS `12073` — see `ingest/pilot/README.md` for the
region, its measured extent, and why that region. Only one polygon out of the federal coverage is
used; the rest of the archive is fetched but not ingested.

### 2.6 BKG basemap.de 3D Gelände — terrain for the 3D parcel preview (display only)

| | |
|---|---|
| Publisher | Bundesamt für Kartographie und Geodäsie (BKG), on behalf of the Länder |
| Use in sela | **Display only.** The ground under the 3D parcel preview (ADR-0006). Never sampled, never stored, never a scoring input — `pv_slope`, `pv_aspect` and `wind_terrain_access` remain unsourced (`docs/domain/scoring-criteria.md`). |
| Data basis | DGM5, production year 2021 (basemap.de 3D product page); updated "unregelmäßig in einem mehrjährigen Intervall" |
| Service | TileJSON `https://sgx.geodatenzentrum.de/gdz_basemapde_3d_gelaende/dgm5_3857_rgb.json` → tiles `https://sg.geodatenzentrum.de/gdz_basemapde_3d_gelaende/dgm5_rgb_tiles/{z}/{x}/{y}.png` |
| Licence | **basemap.de 3D-Beta Dienste** (`https://basemap.de/data/produkte/3d/lizenzen/lizenz_basemapde_3D-Beta.pdf`) — **not** basemap.de Web Raster's CC BY 4.0 |
| Evidence | Licence PDF downloaded and read in full, 2026-09-23. Service probed live the same day (below). |

**What the licence allows, in its own terms.** Usage rights are granted *for the beta version*
(2.1) and *"zu Testzwecken"* (2.2): combining with other services, embedding in public and
non-public applications, and making presentation outputs (analogue or non-georeferenced print
files). Data may be used **only through the service and not stored**; download or reuse outside the
service is not permitted; storing is allowed at runtime only (2.3). The notice
**`© GeoBasis-DE/BKG <Jahr>`** must be clearly visible, and combinations with other services need a
**change notice** (3.1, 3.2). Free of charge during the beta (5).

**What sela does with it, and why that fits.** The preview requests tiles through the service at
runtime, draws them, and keeps nothing: no tile is cached server-side, nothing is written to
`criterion_value`. The notice renders in MapLibre's attribution control as
`Gelände: © GeoBasis-DE/BKG <Jahr> (Daten verändert)` and again, in words, in the preview's source
list. `<Jahr>` is the current year, the same reasoning `lib/basemap/basemap-source.ts` applies to
the 2D basemap: for a live service the year of retrieval is now.

**What it does not allow: a public launch on these terms.** "Zu Testzwecken" during a beta is not a
licence to publish. sela is itself pre-release, and every screen that shows the preview also shows
the *ILLUSTRATIV* marker — but before `1.0` either the beta terms must be replaced by final terms
that permit public use, or the preview must switch to a licence-clean DEM. Recorded as **U10**
(`docs/product/mvp.md` §9). `SELA_TERRAIN=none` turns the terrain off in one step.

**Measured against the live service, 2026-09-23** — three of these differ from, or are missing in,
the product documentation:

- **Tiles are 512 px**, not the 256 px the product page states. Decoded with `sharp`.
- **Encoding is Mapbox terrain-RGB** (`-10000 + (R·65536 + G·256 + B) · 0.1`): a z12 tile over the
  Uckermark decoded to 17.8–80.6 m; the Terrarium formula gave values around −32 375 m.
- **Tiles exist to z15**; z16+ and tiles outside Germany return 404.
- **CORS is open** (`Access-Control-Allow-Origin` echoes the requesting origin).

**The licence-clean fallback: BKG DGM200.** `dl-de/by-2-0`, derived from DGM5, grid spacing
200 m, *Aktualitätsstand* 31.12.2019, notice `© GeoBasis-DE / BKG (<Jahr des letzten Datenbezugs>)
dl-de/by-2-0` (BKG's own product page, read 2026-09-23). It would need to be fetched and turned into
terrain-RGB tiles in the ingest container (GDAL), and at 200 m it is coarser than one 100 m hex cell
— it would flatten precisely the relief a parcel-scale preview is for. **Fetched since, but for a
different job:** it is the source of `pv_slope` (§2.7). It is still not the preview's terrain.

### 2.7 BKG DGM200 — terrain slope → `pv_slope`

| | |
|---|---|
| Publisher | Bundesamt für Kartographie und Geodäsie (BKG) |
| Use in sela | `pv_slope` — slope in degrees, derived with `gdaldem slope` and sampled at each hex cell's centre (`ingest/real/13_dgm200.sh`, `20_sample.sql`) |
| Retrieved artefact | `https://daten.gdz.bkg.bund.de/produkte/dgm/dgm200/aktuell/dgm200.utm32s.geotiff.zip` — **fetched 2026-09-23**, 38 135 308 bytes, publisher md5 `67521dd25099b24f3db6cef65ee79ea7` verified; sha256 in `data/raw/bkg-dgm200/fetch-provenance.json` |
| Grid / projection | 200 m, EPSG:25832 (UTM32S GeoTIFF variant — no reprojection) |
| Currency | *Aktualitätsstand* 31.12.2019; for Brandenburg the underlying DGM5 source data date from **2009–2017** (`aktualitaet.txt` inside the archive) |
| Licence | **`dl-de/by-2-0`** |
| Evidence | `dokumentation/dgm200.pdf` inside the archive (Stand 17.03.2021), section *Nutzungsbestimmungen und Quellenvermerk*, read 2026-09-23; BKG product page read the same day (§2.6) |

**A discrepancy inside the archive, resolved in favour of the dated document.** The archive also
ships `geonutzv.pdf` and `geonutzv_eng.pdf`, both dated 2017-11-29 — older than the product
documentation, which names `dl-de/by-2-0`. The documentation and the product page agree, so
`dl-de/by-2-0` is recorded. Both licences permit derived, published outputs with attribution and a
change notice, so the discrepancy does not change what sela may do — only which licence name it
cites.

**Pinned by md5, not `Last-Modified`.** The host answered two consecutive requests for the same
bytes with two different `Last-Modified` values (`07:26:46` and `07:12:48 GMT`, both 17 Jul 2024)
— different backends behind one name. A `Last-Modified` pin would fail at random, so the manifest
pins the publisher's own `.md5` file instead (`publisherMd5`, checked by `01_fetch.sh`).

**Why confidence is `low` for every cell.** The grid is twice as coarse as a hex cell, so one
DEM value spans several cells and the slope of a single cell is not resolved. The Uckermark
samples 0–7.2°; the relief a parcel-scale decision turns on (a kettle hole, an embankment) is
below this resolution. A finer DEM (DGM1/DGM5 from the LGB, or the BKG DGM25) would lift this; none
is licensed or fetched.

### 2.8 LfU Brandenburg Schutzgebiete (WFS-LFU-SCHUTZG) → protection exclusions

**Why this row exists.** BfN's federal service (§2.1) is licence-cleared but returns 403 to this
environment. The project owner chose on 2026-09-23 to use the Land's own service for the
Brandenburg pilot instead of waiting.

| | |
|---|---|
| Publisher | Landesamt für Umwelt Brandenburg (LfU); service operated by the Landesvermessung und Geobasisinformation Brandenburg (LGB) |
| Use in sela | `pv_protection_status`, `wind_protection_status` — ADR-0004 exclusions, **Uckermark only** |
| Service | `https://inspire.brandenburg.de/services/schutzg_wfs`, WFS 2.0.0, native **EPSG:25833** (reprojected to 25832 on load) |
| Layers fetched | `app:nsg` (Naturschutzgebiete), `app:natp` (Nationalpark), `app:ffh` (FFH-Gebiete), `app:spa` (Vogelschutzgebiete), `app:lsg` (Landschaftsschutzgebiete), `app:br` (Biosphärenreservat) — bbox 13.2–14.5° E, 52.8–53.6° N; feature counts per layer in `fetch-provenance.json` (e.g. 114 NSG, 1 Nationalpark) |
| Licence | **`dl-de/by-2-0`**, from the service's own `AccessConstraints`: *"Als Bezeichnung des Bereitstellers ist „© Landesamt für Umwelt Brandenburg" anzugeben."* |
| Use limitation | Digitised at **1:10 000**; the service describes the data as for information only and **not legally binding** (*nicht rechtsverbindlich*) |
| Evidence | GetCapabilities read 2026-09-23 (`AccessConstraints`, feature-type list); the 1:10 000 scale and the not-legally-binding note from the service description in MetaVer, read the same day through a web-fetch summary rather than directly — re-read before `1.0` |

**What is ingested versus what is used.** All six categories are loaded into
`staging.protection`. Only **NSG and Nationalpark** feed the exclusion (`ingest/real/20_sample.sql`),
because including FFH and SPA excluded **53 %** of the Landkreis — a map that says "not buildable"
over half a county where Natura 2000 designation is in law a requirement for an impact assessment
(*Verträglichkeitsprüfung*), not a ban. That would be a false statement on a public map. NSG and
Nationalpark cover 15.7 %. The narrower rule is itself an illustrative scoring choice
(`docs/domain/scoring-criteria.md` §6) and §3-gated like any other.

**"Nicht rechtsverbindlich" belongs in the interface**, for the same reason as BfN's *"Nicht für
Planungszwecke geeignet"* (§5.1). It is recorded in `source.version` but **not yet rendered** — no
screen shows a source's version today. How it is shown is user-visible behaviour and part of U6;
recorded here as an input to that decision.

### 2.9 LBGR Brandenburg *Moorbodenkarte* (WFS-MBK) → peat soils, carbon stock

**Why this row exists.** The first real `preserve`/`restore` outcome is peatland climate
(`docs/domain/scoring-criteria.md` §4.1, decided by the project owner on 2026-09-24). This is the
state's own peat-soil map, and the only source found that gives a carbon stock per area at a
resolution finer than a hex cell.

| | |
|---|---|
| Publisher | Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg (LBGR) |
| Use in sela | `peat_share`, `peat_soil_class`, `peat_carbon_stock` → `peat-climate-ipcc2013-v1` |
| Service | `https://inspire.brandenburg.de/services/moorkarte_wfs`, WFS 2.0.0, native **EPSG:25833** for all 11 feature types (reprojected to 25832 on load) |
| Layers to fetch | `app:bodentyp_2021` (fields `Bezeichnung`, `Kurzzeichen`, `Jahresscheibe`) and `app:kohlenstoff_2021` (fields `Wert` — a string, e.g. *"< 0,5"* — `Wert_gerundet`, `Einheit` = *"kg/m²"*, `Jahresscheibe`). The service also offers *Moormächtigkeit* and *Substrat* for 19xx, 2013 and 2021, and the survey points (`app:ausgangsdaten`) |
| Metadata | `https://geoportal.brandenburg.de/gs-json/xml?fileid=9fdadef8-7b69-415f-b405-afb129411de3` — *"WFS Moorbodenkarte BB (WFS-MBK)"*; created 2021-01-14, revised **2023-07-18** |
| Resolution | *"Die vorliegenden Vektordatensätze wurden aus einem Grid im 10 m-Raster erzeugt."* (metadata abstract). The service's `Fees` note — *"für Darstellungen in Maßstäben größer 1 : 5000 nicht geeignet"* — does not limit use on 100 m cells |
| Currency | The 2021 layers are a **modelled** state: the carbon layer is the *"potentiell zu erwartenden Vorrat an organischem Kohlenstoff … für das Jahr 2021 … auf Grundlage der abgeleiteten Moormächtigkeit des Jahres 2021"* (capabilities abstract), derived from profiles re-surveyed around 2013 |
| Licence | **`dl-de/by-2-0`**, from the service's own `AccessConstraints`: *"Es gelten die Bedingungen der Datenlizenz Deutschland – Namensnennung – Version 2.0 … Als Bezeichnung des Bereitstellers ist „© Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg" anzugeben."* The metadata record words it the same way and gives the example *"© Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg (LBGR), dl-de/by-2-0, (Daten geändert)"* |
| Uckermark coverage | **Verified** by a GetFeature over 53.0–53.5° N, 13.5–14.2° E: carbon polygons from *"< 0,5"* to 110 kg/m², soil classes including `KV3` *sehr mächtige Erd- und Mulmniedermoore (> 12 dm)* and `HN3` *sehr mächtige ungenutzte Moore* |
| Evidence | GetCapabilities, DescribeFeatureType, GetFeature and the metadata record, all read 2026-09-24 |

**Soil-type classes.** A statewide GetFeature on `app:bodentyp_2021` returned 199 266 features in
29 classes: `KV1`–`KV3`, `HN1`–`HN3`, `GH` *Moorgleye*, `GM` *Anmoorgleye*, `GG` *Gleye*,
`YK,GG` mineral soils, and covered combinations such as `YK,GG\KV2` (*flache mineralische Böden
… 2–3 dm über mächtigen Erd- und Mulmniedermooren*) and `YK,GG/KV2` (… *3–4 dm* …). Reading `\`
as a 2–3 dm and `/` as a 3–4 dm cover is **inferred from the labels**, not from a legend
document, which was not found. Which classes the climate method treats as peat is a proposal in
`docs/domain/scoring-criteria.md` §4.1.

**Not verified.** The soil depth, bulk density and carbon content behind the stock (no LBGR method
document read), and why the layer description is word-for-word the same for 19xx, 2013 and 2021.
Until the method is read, the stock carries at most `medium` confidence.

**A national alternative, not adopted.** Thünen's *Aktualisierte Kulisse organischer Böden*
(Wittnebel, Frank, Tiemeyer 2023) takes Brandenburg directly from this map (*Thünen Working Paper
212*, Tab. 1: LBGR *"Referenzierte Moorkarte (2021)"*, *"Grid (10 m)"*). The Thünen Atlas states
CC BY 4.0; the record at its DOI (`10.3220/DATA20230510130443-0`) could not be read (a bot check).
It is the route to other *Länder*, not a second source for the Uckermark.

### 2.10 LfU Brandenburg *Wasserhaushalt* 1991–2020 (ArcEGMO) → soil and water

| | |
|---|---|
| Publisher | Landesamt für Umwelt Brandenburg (LfU) |
| Use in sela | `percolation`, `root_zone_soil_moisture` and the restore approximation → `water-arcegmo-v1` (`docs/domain/scoring-criteria.md` §4.2) |
| Artefact | `https://data.geobasis-bb.de/geofachdaten/Wasser/Wasserhaushalt/arcegmo_wh_91-20.zip` — **fetched 2026-09-24**, 355 883 698 bytes, `Last-Modified: Thu, 24 Jul 2025 11:37:19 GMT` (pinned), sha256 `1dd62a41c915281e673d04a8fd4ad186194b716dfd760e4ad5a80080c930ed37` — the same hash from two independent downloads |
| Metadata | `https://geoportal.brandenburg.de/gs-json/xml?fileid=9CF2E255-2038-439A-9501-870C4D31A337` — *"Einzugsgebietsmodell des Landes Brandenburg auf der Grundlage von ArcEGMO"* |
| Content | Shapefile `wh_efl20_pscn`, **1 157 871** *Elementarflächen* covering the state, model ArcEGMO-PSCN (VEGEN), EPSG:25833. Fields used: `GWN_91_20` (*"Mittlere Jahressumme der Versickerungsmenge für die Reihe 1991 - 2020"*, mm), `NFK_91_20` (*"Mittlere relative Bodenfeuchte in der Wurzelzone bis 150cm"*, %nFK), `LANDNUTZ` (land-use class, Tab. 2), `HYD_NAME` (hydrotope class, Tab. 3) |
| Scale | *"Einsatzmaßstab: kleiner/gleich 1:10.000"* |
| Currency | Data *Stand* 10.03.2023; documentation *Stand* 27.06.2025 (`dok/doku_efl20_pscn.pdf` inside the archive) |
| Licence | **`dl-de/by-2-0`**. Metadata record: *"Datenlizenz Deutschland Namensnennung 2.0"*, *"Quellenvermerk: „Landesamt für Umwelt Brandenburg"*. Documentation §5: *"Nutzungsrechte: Datenlizenz Deutschland Namensnennung 2.0"*, *"Präsentation: mit Erlaubnisvermerk sowie Quelle und Stand der Daten"*, *"Hinweise: keine Rückschlüsse auf liegenschaftsrechtliche Belange"* |
| Evidence | Metadata record and the documentation PDF from the archive, read 2026-09-24. The licence line on the download directory page itself was **not** read |

**What it is and is not.** It is a model, not a measurement, driven by BÜK300 soils and CIR land
use, so its land use is older than CLC5-2018 in places. `GWN_91_20` is **percolation**
(*Versickerung*), which the screen must not call *Grundwasserneubildung*. The documentation's
*"Stand der Daten"* has to appear with the value (*Präsentation*, above), not only in a footer.

### 2.11 IPCC 2013 Wetlands Supplement — the climate method (a citation, not a dataset)

Not a data source, so not a manifest row, but every factor in `docs/domain/scoring-criteria.md`
§4.1 is read from it and it has to be citable to the page.

| | |
|---|---|
| Citation | IPCC, *2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands*. **The full citation (editors, year of publication, publisher) is read from the title page before it is printed on the method page**; only the two chapters below have been read |
| Chapter 2 | `https://www.ipcc-nggip.iges.or.jp/public/wetlands/pdf/Wetlands_separate_files/WS_Chp2_Drained_Inland_Organic_Soils.pdf` — Tables 2.1–2.5 read 2026-09-24 |
| Chapter 3 | `https://www.ipcc-nggip.iges.or.jp/public/wetlands/pdf/Wetlands_separate_files/WS_Chp3_Rewetted_Organic_Soils.pdf` — Tables 3.1–3.3 and p. 3.19 read 2026-09-24 |
| Dead links | `…/pdf/Wetlands_Supplement_Chp2.pdf` and `…Chp3.pdf` return 404 |
| Not yet read | The GWP basis (not stated in either chapter as far as a text search found); the equation combining `EF_CH4_ditch` with `Frac_ditch`; any ditch term for rewetted soils — V1–V3 in `scoring-criteria.md` §4.1 |

**The German cross-check, not used yet.** The *Nationaler Inventarbericht* 2025 (UBA, *Climate
Change* 39/2025), Tabelle 326, p. 518, gives implied emission factors for organic soils derived
from Tiemeyer et al. (2020). Its header reads *"t CO2-C ha⁻¹ a⁻¹"*, but Tabelle 386 (p. 640) gives
the same 26.48 for *Ackerland* in *"t CO2-Eq"*. Until that is resolved, the table is not cited
for a number.

### 2.4 OpenStreetMap via Geofabrik — basemap, settlement geometry

| | |
|---|---|
| Publisher | OpenStreetMap contributors / OSM Foundation; Geofabrik (extract service) |
| Use in sela | Basemap (ADR-0003); settlement geometry for `wind_settlement_setback` |
| Version | Rolling — pinned to extract date at ingest time. **Not yet pinned for the pilot** |
| Coverage / geometry | Federal, vector |
| Licence | **ODbL 1.0** |
| Evidence | `openstreetmap.org/copyright` re-read 2026-09-18; **ODbL legal code itself** read at `opendatacommons.org/licenses/odbl/1-0/`, 2026-09-18 |

**Derived outputs — permitted, but not on the same terms as the other three.** This row needs a
decision rather than a status, and §4 states it. Geofabrik is additionally unreachable from this
environment (§6), so the extract cannot be pinned here either way.

---

## 3. Required attribution

Exact strings, taken from each publisher's own instructions. These are what
`design-language.md` §7's provenance footer and every screen's attribution block must carry; a
licence verified and then not attributed is worse than one never used.

| Source | Required notice | Notes |
|---|---|---|
| BfN | `Bundesamt für Naturschutz (BfN) <Jahr>` plus the GeoNutzV reference (`https://sg.geodatenzentrum.de/web_public/gdz/lizenz/geonutzv.pdf`) | GeoNutzV §3: must be "erkennbar und in optischem Zusammenhang" with the data, and carry a *Veränderungshinweis* for any alteration. Template is from BfN's own metadata records; re-read the live capabilities document before ingest (§2.1). |
| BKG | **`© GeoBasis-DE / BKG <Jahr des letzten Datenbezugs> (Daten verändert)`** — the *(Daten verändert)* form, not the plain one | Taken from `quellenvermerk_datenlizenz_deutschland.txt`, which ships **inside the CLC5 archive itself** (read 2026-09-19) — the publisher's own instruction rather than a web page. It gives exactly two forms, unchanged and *"(Daten verändert)"*, and **sela must always use the second**: a `criterion_value` derived from CLC5 polygons is by definition an alteration. It requires the notice to be placed "erkennbar und in optischem Zusammenhang" with the data and, on a web page, the *Quellenvermerk* hyperlinked to `http://www.bkg.bund.de`. Note a **discrepancy to resolve before rendering**: this file's form does **not** include the `dl-de/by-2-0` label, while BKG's GDI-DE metadata record for CLC5 gives `© GeoBasis-DE / BKG (Jahr des Datenbezugs) dl-de/by-2-0`. Carrying both the licence label (linked to `https://www.govdata.de/dl-de/by-2-0`) and the change notice satisfies both readings and is the safe choice. |
| BKG — **VG25 only** | **`© BKG <Jahr des letzten Datenbezugs> CC BY 4.0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf`** | From `nutzungsbedingungen_vg25.pdf` inside the VG25 archive (read 2026-09-19). **Do not reuse the CLC5 notice for this** — VG25 is CC BY 4.0 and its *Quellenvermerk* is `© BKG`, without the `GeoBasis-DE /` prefix. On a web page "BKG" links to `https://www.bkg.bund.de` and "CC BY 4.0" to `https://creativecommons.org/licenses/by/4.0`. A *Veränderungshinweis* is required for any edited or transformed use, which clipping a grid to this boundary is. |
| BKG — **basemap.de 3D Gelände only** | **`© GeoBasis-DE/BKG <Jahr>`**, with a change notice when combined with other services | From `lizenz_basemapde_3D-Beta.pdf` §3 (read 2026-09-23). The preview always combines it with other services, so it always renders as `© GeoBasis-DE/BKG <Jahr> (Daten verändert)`. |
| BKG — **DGM200 only** | **`© GeoBasis-DE / BKG <Jahr> dl-de/by-2-0 (Daten verändert)`** | From `dgm200.pdf` inside the archive (read 2026-09-23). A slope derived from the DEM is an alteration, so the change notice always applies; `lib/attribution.ts` appends it. |
| LfU Brandenburg | **`© Landesamt für Umwelt Brandenburg dl-de/by-2-0 (Daten verändert)`**, licence linked to `https://www.govdata.de/dl-de/by-2-0` | The *Bereitsteller* wording is the service's own `AccessConstraints` (read 2026-09-23). A per-cell covered share is an alteration. |
| LBGR Brandenburg | **`© Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg (LBGR) dl-de/by-2-0 (Daten verändert)`**, licence linked to `https://www.govdata.de/dl-de/by-2-0` | The publisher's own example in the metadata record (read 2026-09-24), with its optional change notice made mandatory: a peat share or an area-weighted stock per cell is an alteration. The example writes *(Daten geändert)*; sela renders its one standard wording, *(Daten verändert)* (`lib/attribution.ts`), which says the same. |
| LfU Brandenburg — **ArcEGMO water balance** | **`Landesamt für Umwelt Brandenburg, Wasserhaushaltsgrößen 1991–2020 (ArcEGMO), Stand 10.03.2023, dl-de/by-2-0 (Daten verändert)`** | The documentation requires *"Erlaubnisvermerk sowie Quelle und Stand der Daten"* (§5), so the data date is part of the notice, not optional. |
| DWD | `Quelle: Deutscher Wetterdienst` (text form; the DWD logo is an accepted alternative) | Per §7 DWD-Gesetz. To be placed **immediately at the DWD information used**. For substantial modification DWD expects at minimum to be named in a central source list or the Impressum, together with a change notice — DWD's own examples include *"Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt"*, which is precisely what sampling a 1 km grid onto hex cells is. The dataset additionally carries its own required citation: `DWD Climate Data Center (CDC): Gridded annual sum of incoming shortwave radiation (global radiation) on the horizontal plain for Germany based on ground and satellite measurements, Version V003, <current year>.` |
| OSM | `© OpenStreetMap contributors` with the data made clear to be available under the Open Database License — linking to `https://www.openstreetmap.org/copyright` satisfies the latter for a browsable map; printed works must carry the full URL | ADR-0003 already records this as a standing duty on **every screen and every export**. Distributing OSM in data form requires naming and linking the licence directly. |

A practical consequence for `docs/product/design-language.md` §7: the provenance footer must be
able to render a per-source notice with a hyperlink and a change notice, not a single flat credit
line. Whether that fits the current card layout has not been checked — it is user-visible
behaviour and therefore §3-gated; recorded here rather than silently designed.

---

## 4. Resolved decision — ODbL share-alike and sela's own database

**Decided 2026-09-19: option (b), taken to its conclusion — OpenStreetMap leaves sela's stack
entirely. See `docs/architecture/adr-0005-osm-free-stack.md`.** The analysis below is retained
unchanged, because the reasoning is why the decision went the way it did and a later session
reopening it needs the argument, not just the outcome.

Why (b) over (a): a **perpetual, irreversible licence obligation on sela's entire scoring
database** is a larger cost than a **documented accuracy limit on one criterion** — and
`CLAUDE.md` §4.5 requires that accuracy limit to be shown in the interface anyway, so it is a cost
sela was always going to pay in honesty rather than one it now incurs. Why not (c): legal advice
remains available and nothing here forecloses (a), but §4.1's research removed the need to buy an
answer before proceeding.

What changed to make (b) cheap: when the options were written, (b) had unpriced research attached
and still left an ODbL obligation on the basemap archive. §4.1 closed both gaps.

---

*The original analysis, as recorded 2026-09-18:*

This is the substantive finding of the 2026-09-18 verification, and it is a `CLAUDE.md` §3
decision (data sources and licensing, affecting whether derived outputs may be published). It is
recorded, not taken.

The 2026-08-22 note on this row read: "derived/aggregated results (like a criterion value) count as
a 'produced work' under ODbL's usual reading, not a database extract subject to share-alike." That
was an interpretation stated as a fact, and **reading the ODbL legal code does not support it.**
The licence defines the two terms narrowly:

> **"Produced Work"** – a work (such as an image, audiovisual material, text, or sounds) resulting
> from using the whole or a Substantial part of the Contents (via a search or other query) from
> this Database […]
>
> **"Derivative Database"** – Means a database based upon the Database, and includes any
> translation, adaptation, arrangement, modification, or any other alteration of the Database or of
> a Substantial part of the Contents. This includes, but is not limited to, **Extracting or
> Re-utilising the whole or a Substantial part of the Contents in a new Database.**

A Produced Work is an *image, audiovisual material, text or sound* — not a table of values. A
per-cell `criterion_value` computed from OSM settlement geometry and stored in sela's PostGIS
database is, on the face of the definition, an Extraction of a Substantial part of the Contents
into a new Database — a **Derivative Database**. §4.5(b) is the escape hatch, and it only covers
using the data *to create a Produced Work*; it does not convert a derived table into one.

Two clauses then bite on anything sela publishes:

- **§4.4 Share Alike** — a publicly used Derivative Database must itself be offered under ODbL.
- **§4.6 Access to Derivative Databases** — if you Publicly Use a Derivative Database **or a
  Produced Work from one**, you must also offer recipients a machine-readable copy of either the
  entire Derivative Database or a file describing all alterations (including the algorithm), free
  of charge over the internet.

Note that §4.6 reaches the scenario cards and screenshots too: they are Produced Works *from* a
Derivative Database, so the obligation follows them.

Two places where sela touches OSM, and they are not the same:

1. **The PMTiles basemap archive** (ADR-0003, `ingest/basemap/build.sh`). Building vector tiles from
   an OSM extract and serving them is Publicly Using a Derivative Database. This is well-trodden
   ground — self-hosted OSM tiles are published this way routinely — but §4.4 and §4.6 apply to the
   archive, and the archive is self-contained, so satisfying them costs little.
2. **`wind_settlement_setback`** — OSM settlement geometry intersected onto hex cells and written
   into `criterion_value`. This is the consequential one: it puts OSM-derived rows **inside sela's
   own scoring database**, alongside GeoNutzV, `dl-de/by-2-0` and CC BY 4.0 data that carry no
   share-alike at all.

Three ways forward, in the order the project's own principles suggest:

- **(a) Publish the derived database openly under ODbL.** `CLAUDE.md` §4.1 already requires every
  number to decompose to its evidence in the interface; offering a machine-readable dump of
  `criterion_value` is a smaller step from there than it looks, and §4.6 compliance becomes a
  feature of the public-explainability story rather than a cost. It does commit sela's scoring
  database to ODbL terms in perpetuity for as long as OSM-derived rows are in it.
- **(b) Keep OSM out of `criterion_value` entirely.** Use OSM only for the basemap archive, which
  can carry its own ODbL notice and §4.6 offer in isolation, and source settlement geometry for the
  wind setback from a GeoNutzV or `dl-de/by-2-0` dataset instead. No such dataset has been
  identified yet — this option has research attached, not just a decision.
- **(c) Take legal advice** before either. The share-alike boundary for a scored, aggregated value
  derived from a Substantial part of a database is not a settled question, and sela is a
  public-facing platform whose credibility is the product.

This document did not choose when it was written. It recorded that **choosing (a) or (b) is a
precondition for `wind_settlement_setback` entering ingestion**, and that the basemap path is
unaffected by the choice. Option (b) was chosen on 2026-09-19; the basemap moved too, which the
2026-09-18 framing did not anticipate as possible.

### 4.1 Non-ODbL alternatives — researched 2026-09-19

Option (b) above was recorded on 2026-09-18 with the caveat "No such dataset has been identified
yet — this option has research attached, not just a decision." That research was commissioned on
2026-09-19 and is done. **Both of sela's OSM dependencies turn out to have a non-ODbL substitute,
and each substitute costs something specific.** This does not choose between (a), (b) and (c); it
prices them.

Every licence below was read in the publisher's own ISO 19139 metadata record (the
`gmd:otherConstraints` field) via the GDI-DE catalogue, and every content statement comes from
BKG's own product documentation, cited per row. Nothing here is inferred from the fact that a file
sits on an open-data server — that inference is precisely what `CLAUDE.md` §5 ("no invented facts")
forbids, and this section contains one dataset where it would have produced the wrong answer.

#### The settlement-geometry question

| Candidate | Licence (verified) | What it contains | Why it is not OSM |
|---|---|---|---|
| **BKG CLC5**, CLC classes **111** *Durchgängig städtische Prägung* and **112** *Nicht durchgängig städtische Prägung* | **`dl-de/by-2-0`** — BKG's own record for both *CORINE Land Cover 2018 – 5 ha* and *2021 – 5 ha* | Urban-fabric polygons, federal coverage | **5 ha minimum mapping unit.** Anything smaller than 5 ha — an isolated farmstead, a small hamlet — is not represented at all. Class 112 also encloses the gardens, yards and roads inside a settlement, so its outline sits *outside* the built edge by an unquantified margin. Class **121** is *Industrie- und Gewerbeflächen* and must be **excluded**: a setback to *Wohnbebauung* is not a setback to an industrial estate. |
| **BKG DLM250**, layer **SIE01_F** (ATKIS object class **52001 `AX_Ortslage`**) | **GeoNutzV** (`geoNutz/20130319`) — the same regime sela has already cleared for BfN (§2.1) | Generalized *Ortslage* (settlement) polygons, federal coverage | **Generalized for 1:250 000.** BKG's own documentation (Stand 28.05.2026) further records that a settlement is modelled **as a point** where it is "eine selbstständige Gemeinde ohne eigene Ortslage (Sammelgemeinde)" — so the layer is not uniformly polygonal, which a distance computation has to handle rather than assume away. |

**Ruled out, with the reason recorded so it is not re-researched:**

- **BKG LBM-DE2021** — the 1 ha land-cover model CLC5 is generalized *from*, and therefore the
  obvious way to get finer settlement outlines under the same licence family. Its GDI-DE records
  do **not** carry `dl-de/by-2-0`. They carry: *"Es gelten Zugriffsbeschränkungen. Für den Erwerb
  von Nutzungsrechten wenden Sie sich deshalb bitte an die Zentrale Stelle Geotopographie der AdV
  (ZSGT) / Dienstleistungszentrum (DLZ) des Bundesamtes für Kartographie und Geodäsie"* — access
  restrictions, rights to be acquired on request. The `lbm-de2021.utm32s.gpkg.zip` artefact is
  nonetheless reachable on `daten.gdz.bkg.bund.de`, which is exactly the trap: **reachable on the
  open-data host is not the same as openly licensed.**
- **BKG DLM250, layer SIE05 (`31001 AX_Gebaeude`)** — a building layer does exist in DLM250, and it
  is not a building stock. BKG's capture criteria list it as a *selection*: youth hostels; huts
  with more than 19 beds; buildings of the supreme federal authorities; parliaments; supreme
  federal courts; planetaria; significant theatres, concert halls and museums; churches selected
  partly by height. A *Wohnbebauung* setback cannot be computed from it.
- **BKG Hausumringe (HU-DE)** — building outlines would be the ideal input. HU-DE does not appear
  under any category on `daten.gdz.bkg.bund.de/produkte/`, so it is not part of BKG's open-data
  offering and no open licence could be verified for it.

**What this means for option (b):** its settlement leg is **available but coarser**, and the
cheaper of the two candidates costs nothing new — CLC5 is already Confirmed, already pinned,
already fetched (§2.2), and already in sela for `pv_land_cover`. Using classes 111/112 from it adds
no dataset, no licence, and no new attribution obligation. What it adds is **error**: a setback
measured from a 5 ha-generalized land-cover polygon is a different quantity from a setback measured
from OSM building geometry, and `CLAUDE.md` §4.5 requires that difference to be visible in the
interface as confidence, not hidden. The honest framing is that option (b) trades a licensing
constraint for a documented accuracy cost — it does not avoid a cost.

#### The basemap question — two options that are not OSM-self-hosted


§4 records that the basemap leg is "unaffected by the choice", because a self-contained OSM tile
archive can carry its own ODbL notice in isolation. That remains true. But it is now also true that
**the basemap does not have to be OSM at all.**

BKG publishes **basemap.de Web Vektor** — an official German vector basemap, shipped as vector
tiles in EPSG:3857 with its own styles, fonts and sprites, at
`daten.gdz.bkg.bund.de/produkte/basiskarten/basemapde_web_vektor/aktuell/`. Its terms of use
(*Nutzungsbedingungen und Quellenvermerk basemap.de*, read in full 2026-09-19) state that the data
is provided free of charge under **Creative Commons Namensnennung 4.0 International (CC BY 4.0)**,
with `dl-de/by-2-0` offered as an alternative where CC BY 4.0 cannot be used. The scope clause
names basemap.de Web Raster, Web Raster Schummerung, **Web Vektor** and P10 explicitly. **No
share-alike.**

This is a lead, not a recommendation, and three things about it are **not** yet verified:

1. ADR-0003 chose **PMTiles built with Planetiler**. basemap.de ships pre-built vector tiles in a
   tar archive (`bm_web_de_3857.tar.gz`, 6 872 125 529 bytes as of `Last-Modified: Tue, 18 Aug 2026
   11:24:32 GMT`); whether and how that converts to a single PMTiles archive has not been tested.
2. EPSG:**3857**, where sela's basemap tiles would otherwise be built from a source of its own
   choosing. Serving CRS is fine; the point is that the tiling is fixed by the publisher.
3. Restyling latitude. sela's design language (`docs/product/design-language.md`) constrains the
   basemap's appearance; a pre-built vector tile set is restylable in principle, but its layer
   schema is BKG's, not Planetiler's, so `ingest/basemap/` would be rewritten, not reconfigured.

**A third option, from sela's own prior art.** `richardkfm/alpha` — the earlier project — used
**hosted raster tiles from CARTO** (`basemaps.cartocdn.com`, styles `dark_all`, `dark_nolabels`,
`light_nolabels`), attributed as *"© OpenStreetMap © CARTO"*. Inspected 2026-09-19. Its properties
are the opposite of ADR-0003's choice in every respect: no build pipeline, no archive, no storage —
and no control. It is a third-party service with its own terms and usage limits, it is raster where
sela's design language wants restylable vector, and ADR-0003 rejected exactly this dependency shape
("a container that fetches fonts from a CDN is not self-contained"). **It does not change §4 at
all:** it is still OSM-derived, so ODbL attribution follows it, but a hosted basemap never puts OSM
data into `criterion_value` — and that, not the map background, is the leg §4 turns on. Its honest
role is as a stopgap that would put a real map on screen while the basemap question is decided.

**Tested 2026-09-19, and the result reordered the options.** Both remote basemaps were rendered in
a real browser against the pilot region:

- **CARTO watermarks every unauthenticated tile.** All 49 tiles returned HTTP 200 and drew
  correctly — with *"API KEY REQUIRED — carto.com/basemaps/apikey"* stamped diagonally across each
  one. `richardkfm/alpha`'s configuration therefore no longer produces a clean map; whatever it
  looked like when that code was written, an account is needed now. Unusable as a stopgap without
  one.
- **basemap.de works with no account.** Its WMTS at
  `sgx.geodatenzentrum.de/wmts_basemapde` publishes a `GLOBAL_WEBMERCATOR` matrix set, which is
  plain XYZ as far as MapLibre is concerned — no WMS plumbing, no key, 49/49 tiles clean. Two
  styles, `de_basemapde_web_raster_grau` and `_farbe`; the grey one is the match for
  `design-language.md` §4.1's desaturated requirement. Note the path order is WMTS's
  `{TileMatrix}/{TileRow}/{TileCol}` — **z/y/x**, not MapLibre's usual z/x/y.

So the development fallback wired up on 2026-09-19 is **basemap.de**, with CARTO kept selectable
behind `SELA_BASEMAP=carto` for anyone who has a key. One caveat against §4.1's earlier framing:
these raster tiles carry **baked-in labels**, where the PMTiles style deliberately carries none
until a self-hosted glyph pipeline exists. That is a visible difference, not a neutral swap.

**Switching the basemap *permanently* is an ADR-0003 change and therefore §3-gated.** What was
taken on 2026-09-19 is a reversible development default, switchable by one environment variable;
ADR-0003's self-hosted archive is still what has to exist before anything public ships. What it changes about §4 is the shape of option (b): if both legs move off OSM, ODbL leaves
sela's stack entirely and §4.6's machine-readable-access duty never attaches to anything — which is
a materially different proposition from the 2026-09-18 framing, where option (b) still left an ODbL
obligation sitting on the basemap archive.

---

## 5. Open items

### 5.1 "Nicht für Planungszwecke geeignet"

Every BfN record inspected carries the use limitation *"Nicht für Planungszwecke geeignet"* (not
suitable for planning purposes). `0.2.1` noted this from the WFS capabilities document; it is now
confirmed as a field in the datasets' own metadata, not an incidental remark in a service
description.

It does not block sela's use — sela is explicitly advisory and explicitly not a permitting or
planning instrument (`CLAUDE.md` §5, `docs/product/mvp.md` §3). But sela's audience includes
municipal planning offices, and a screenshot of a sela comparison will end up in a council packet.
Carrying a source's own "not for planning purposes" limitation into the interface, where protection
status is doing the work of an ADR-0004 exclusion, is the honest reading of `CLAUDE.md` §4.5.

**This is U6 (disclaimer posture), and it is user-visible behaviour — §3-gated.** Recorded here so
the decision has this input when it is taken.

### 5.2 Which years feed `pv_irradiation_annual` — decided 2026-09-19

Fetching the DWD series raised a question that pinning a version does not answer: a single annual
radiation grid is a **weather observation**, not a site property. Germany's annual totals swing by
roughly 20 % between years in this very series — 909 kWh/m² minimum in 2000 against 1 319 kWh/m²
maximum in 2020, across the sampled files. Scoring a parcel's solar potential from one year makes
the verdict a function of which year was chosen.

The realistic options are a single recent year, a rolling mean over the last N years, or the WMO
climate normal period 1991–2020. They produce different numbers for the same land.

**Decided: a 10-year trailing mean, currently 2016–2025.** Recorded in
`ingest/sources.manifest.json` under `dwd-cdc-radiation.aggregation`.

The decision was made against the data rather than by argument. Every grid in the fetched series
was read and reduced to a Germany-wide mean (359 586 valid 1 km cells per year, which is Germany's
land area to within 0.6 %):

| Window | Mean kWh/m² | Interannual sd | sd / mean |
|---|---|---|---|
| 1991–2020 (WMO normal) | 1 085.7 | 48.3 | 4.4 % |
| 2006–2025 (last 20) | 1 117.9 | 49.0 | 4.4 % |
| **2016–2025 (last 10)** | **1 144.7** | 53.3 | 4.7 % |
| 2025 alone | 1 187.2 | — | — |

Two facts decide it:

1. **Global radiation over Germany is trending up**, by **+3.35 kWh/m² per year** across
   1991–2025 — about +117 kWh/m², or +11 %, over the record. This is the well-documented European
   "brightening"; sela does not need to explain it, only to not be wrong because of it.
2. **That trend makes the WMO normal the worst option, not the safest.** 1991–2020 sits **5.4 %
   below** the last decade — a systematic low bias as large as DWD's own ±6 % method uncertainty,
   applied to every parcel. A climatology that is reliably wrong in one direction is worse for
   sela's purpose than a noisier one that is not.

A single year is also out: the record ranges 995.9 (1998) to 1 227.4 (2022) kWh/m², so the choice
of year would move a parcel's solar verdict by up to 23 %.

Ten years is the compromise: the sampling term falls to sd/√10 ≈ 16.9 kWh/m², **1.5 %** of the
mean, while the window stays short enough to track the trend rather than average it away.

**On confidence.** §2.3's ±6 % is DWD's method uncertainty, and the conservative reading is that it
is systematic and does **not** average down. The sampling term a 10-year mean adds is 1.5 %, which
in quadrature gives √(6² + 1.5²) ≈ 6.2 %. So `criterion_value.confidence` for this criterion
carries **±6 %**, and it does so because the derivation was done, not because the single-grid figure
was copied across.

**Maintenance.** The window rolls forward when DWD publishes a new year — around February.
Changing `windowYears` is a `CLAUDE.md` §3 scoring decision, not routine maintenance: it changes
what the public is told about real land.

---

## 6. Verification log

Entries record what was actually fetched and read, so a later session does not repeat a dead end or
mistake an attempt for a confirmation.

### 2026-09-24 (later), nature capital ingest

- **LBGR *Moorbodenkarte*** — `app:bodentyp_2021` (40 475 features) and `app:kohlenstoff_2021`
  (57 788) fetched for the Uckermark bbox. The GeoPackages' sha256 differs between two fetches of
  the same features (the files carry write timestamps), so the feature count, not the hash, is what
  a re-fetch can be checked against. The carbon stock is published as whole kg/m² (`Wert_gerundet`)
  plus a class *"< 0,5"*.
- **LfU ArcEGMO** — fetched and pinned (§2.10). The archive holds three documentation files; the
  one for the *Elementarflächen* is `dok/doku_efl20_pscn.pdf` (Tab. 2 `LANDNUTZ`, Tab. 3
  `HYD_NAME`, both read in full). 132 840 *Elementarflächen* touch the Uckermark's extent.
- **Verification items V1–V5** (`docs/domain/scoring-criteria.md` §4): the AR5 GWPs (WG1 Ch. 8)
  and the German inventory's use of them (NID 2025), the Wetlands Supplement's Eq. 2.6 and Ch. 3's
  rule on ditches, and the ArcEGMO code tables, all read. V4, the depth basis of LBGR's carbon
  stock, is **still unread**: `lbgr.brandenburg.de` and `geo.brandenburg.de` fail TLS through
  this environment's proxy, and the nearest paper (Fell et al. 2015, *Telma* 45) does not
  describe the stock layer.
- **The pipeline ran end to end** with both sources (`ingest/run.sh`, then `pnpm db:materialize`).

### 2026-09-24, nature capital research (U2)

- **LBGR *Moorbodenkarte* WFS** — GetCapabilities, DescribeFeatureType, GetFeature and the
  metadata record read; Uckermark coverage verified with a bbox query; 29 soil classes listed
  statewide (§2.9). Confirmed by the project owner's decision to model peat climate.
- **LfU ArcEGMO water balance** — metadata record and the archive's documentation read; HEAD on
  the archive (§2.10). Confirmed by the same decision. **Not fetched yet.**
- **IPCC Wetlands Supplement** Ch. 2 and 3 read; factors and pages in `scoring-criteria.md` §4.1
  (§2.11). NIR 2025 read; its unit label in Tabelle 326 is inconsistent with Tabelle 386.
- **Considered and not adopted**, recorded in §8: LfU *Biotopkataster* and CIR-BTLN 2009 (habitat,
  for the later categorical view); BGR BÜK200 and GWN1000; BKompV Anlage 2 as a points scale.
- **Access problems:** `openagrar.de` (a bot check), `metaver.de` (HTTP 429), the LfU biotope
  progress PDF at `mleuv-daten.brandenburg.de` (TLS failure), `bgr.bund.de` pages (HTTP 400 behind
  a cookie wall; the AGB PDF was reachable), the GDI-DE catalogue search (connection reset).

### 2026-09-23 (later), real Uckermark ingest

- **BKG DGM200** — fetched; md5 checked against the publisher's `.md5`; `dgm200.pdf` and
  `aktualitaet.txt` read (§2.7). Two `Last-Modified` values observed for the same bytes.
- **LfU Brandenburg WFS** — GetCapabilities read; six layers fetched with `ogr2ogr` into one
  GeoPackage each (§2.8).
- **The whole pipeline ran end to end** (`ingest/run.sh`, `ingest/real/`): 117 191 hex cells;
  irradiation for 117 140 of them (the rest lie on the Oder, outside DWD's grid), 1 100–1 137
  kWh/m²; slope 0–7.2°; dominant land cover led by class 211; NSG/Nationalpark share per cell.
- **Incident: duplicated grid.** Two grid runs started concurrently wrote 234 382 duplicate cells.
  Removed (kept the lower id of each `ST_Equals` pair) and prevented: `04_generate_grid.sql` now
  runs in one transaction under a per-region advisory lock.
- **Incident: truncated WFS response.** A later full run got a `GetFeature` response for `app:ffh`
  cut off mid-transfer (*"XML parsing of GML file failed: no element found"*). `01_fetch.sh` had
  already deleted the good GeoPackage and exited 1, which `run.sh` reads as "licence gate", so
  the run continued until the load step failed. Fixed: each layer is fetched to a temporary file,
  retried up to three times, and moved into place only once it opens; failure exits with the new
  code 5, which aborts the run. A re-fetch returned the same feature counts per layer.
- **Observation, not a finding:** irradiation varies by only 3 % across the Landkreis, so under the
  illustrative bounds it is the "limiting" criterion almost everywhere. That is an artefact of the
  placeholder normalisation, and is why the bounds are listed as open (`scoring-criteria.md` §6).

### 2026-09-23, 3D parcel preview (ADR-0006)

- **basemap.de 3D Gelände** — licence PDF fetched from `basemap.de` and read in full; TileJSON and
  tiles fetched through the agent proxy; a z12 tile over the Uckermark decoded locally (§2.6). The
  3D product page's MIS record (`mis.bkg.bund.de`, docuuid `882FBE55-…`) returned *"Keine
  Detailinformationen verfügbar"* and was not usable as evidence.
- **BKG DGM200** — product page read (licence, notice, *Aktualitätsstand*); nothing downloaded.
- **Legal texts behind the preview's rings** — not datasets, recorded here because they are cited
  in the interface:
  - **§ 249 Abs. 10 BauGB** — fetched from `gesetze-im-internet.de` and read verbatim (after one
    503). Quoted in `lib/preview/reference-geometry.ts`.
  - **§ 1 BbgWEAAbG** — `bravors.brandenburg.de` **failed TLS verification** from this environment
    (self-signed certificate in chain, also with the proxy CA bundle). The wording was obtained
    through a web-fetch tool's summary of the same page, which reported the law in force (version of
    20.05.2022, amended 02.03.2023) and quoted the 1 000 m rule and its measuring point. **This is a
    weaker verification than a direct read**, and the quote in `reference-geometry.ts` should be
    re-checked against the official text before anything beyond the illustrative preview relies on it.

### 2026-09-19 (later), pilot region chosen

The project owner delegated the choice of pilot *Landkreis*. Picking one needs a boundary, so this
added a fifth dataset.

- `daten.gdz.bkg.bund.de/produkte/vg/vg25_ebenen/aktuell/vg25.utm32s.gpkg.zip` — **fetched**
  (325 132 397 bytes). Chosen over VG250 because 1:25 000 is the precision a 100 m grid deserves,
  and over the GK3/shape variants because the UTM32S GeoPackage is already EPSG:25832.
- `nutzungsbedingungen_vg25.pdf` (inside the archive) — read in full. **VG25 is CC BY 4.0**, and the
  manifest entry written before reading it said `dl-de/by-2-0` by analogy with CLC5. Corrected. The
  *Quellenvermerk* is `© BKG …`, without CLC5's `GeoBasis-DE /` prefix.
- **All 14 Brandenburg *Landkreise* measured from the geometry itself**, not from a reference
  work: Uckermark 3 082.4 km² (largest), Potsdam-Mittelmark 2 593.9, Ostprignitz-Ruppin 2 528.2,
  Dahme-Spreewald 2 278.8, Oder-Spree 2 262.0, Märkisch-Oderland 2 163.3, Prignitz 2 138.9,
  Teltow-Fläming 2 107.0, Elbe-Elster 1 902.1, Oberhavel 1 810.3, Havelland 1 728.5,
  Spree-Neiße 1 661.4, Barnim 1 482.0, Oberspreewald-Lausitz 1 226.0.
- **`richardkfm/alpha` inspected** for the basemap it used, at the owner's prompting: hosted raster
  tiles from `basemaps.cartocdn.com` (`dark_all`, `dark_nolabels`, `light_nolabels`), attributed to
  OpenStreetMap + CARTO. Recorded in §4.1 as a third basemap option — it is OSM-derived and so does
  not avoid ODbL attribution, but it never puts OSM data into sela's database, which is the leg §4
  is actually about.

**Caveat on how the boundary was cut.** GDAL is not installed in this environment, so the
GeoPackage was parsed directly and `ingest/02b_extract_pilot_boundary.sh` — the reproducible
`ogr2ogr` path — **has not been run**. Diff its output against the committed file before trusting
either.

### 2026-09-19, first real fetch + alternatives research

The first session in which sela retrieved real data. Two things happened: the §3 decision to flip
`bkg-clc5` and `dwd-cdc-radiation` to `confirmed` was taken by the project owner, and the option-(b)
research §4 had left outstanding was carried out.

- **`ingest/01_fetch.sh` gained real fetch implementations** for the two confirmed sources, and was
  run for both. Every artefact's byte count, upstream `Last-Modified` and sha256 is written to
  `data/raw/<source_id>/fetch-provenance.json`. The gate was re-tested against
  `bfn-schutzgebiete` first and correctly refused before making any network call.
- `daten.gdz.bkg.bund.de/…/clc5_2018.utm32s.shape.zip` — **fetched in full.** The `HEAD` pin
  recorded on 2026-09-18 still holds exactly: 1 361 366 128 bytes, `Last-Modified: Fri, 25 Mar 2022
  13:15:09 GMT`. `01_fetch.sh` now verifies both against the manifest and aborts on drift rather
  than ingesting a silently re-issued file.
- `opendata.dwd.de/…/radiation_global/` — **35 annual grids plus both description PDFs fetched**
  (37 artefacts, 7 021 079 bytes). Contents verified against §2.3's claims; two upstream defects
  found and recorded there.
- `gdk.gdi-de.org/gdi-de/srv/ger/csw` — used again, this time for BKG's own records. *CORINE Land
  Cover 2018 – 5 ha* and *2021 – 5 ha* both carry
  `{"id":"dl-by-de/2.0", …, "quelle":"© GeoBasis-DE / BKG (Jahr des Datenbezugs)"}`, independently
  re-confirming the CLC5 licence from a second source. *Landbedeckungsmodell für Deutschland*
  records carry **access restrictions instead** (§4.1). ATKIS DLM250 records carry
  `geoNutz/20130319`.
- `sgx.geodatenzentrum.de/web_public/gdz/dokumentation/deu/{clc5_2021,lbm-de2021,dlm250}.pdf` —
  fetched and read. Source of the CLC class list, the DLM250 layer-to-object-class table and the
  DLM250 capture criteria quoted in §4.1. Note these documentation PDFs contain **no** licence
  statement; the licence had to come from the metadata records.
- `sgx.geodatenzentrum.de/web_public/gdz/lizenz/deu/nutzungsbedingungen_basemapde.pdf` — fetched
  and read in full. Source of the CC BY 4.0 finding in §4.1. The URL named in the basemap.de
  service metadata (`…/lizenz/deu/basemapde_web_dienste_lizenz.pdf`) **404s**; the file above is
  the one that exists.
- **`CLC5-2021` exists and sela is pinned to 2018.** `daten.gdz.bkg.bund.de/produkte/dlm/clc5_2021/`
  carries `clc5_2021.utm32s.gpkg.zip` (1 562 531 359 bytes, `Last-Modified: Thu, 23 Apr 2026
  10:02:17 GMT`), derived from LBM-DE2021, documented Stand 07.04.2026, same `dl-de/by-2-0`
  licence. Moving to it would cut the data-currency gap in §2.2 by three years. It is a **change of
  source version and therefore §3-gated**; recorded, not taken. Note it is GeoPackage only — no
  shapefile variant is published for 2021.

### 2026-09-18, U7 licence-gate session

Four of the five dead ends from 2026-08-22 resolved; every dataset's licence terms are now read at
a primary source.

- `gesetze-im-internet.de/geonutzv/BJNR054700013.html` — **fetched and read in full.** This is the
  URL the August session needed and did not find; `/geonutzv/index.html` returns only the table of
  contents. §2 (Nutzungen) and §3 (Quellenvermerke) are quoted in §2.1 above. Resolves the BfN
  row's blocking question.
- `govdata.de/dl-de/by-2-0` — **fetched and read** (HTTP 503 in August). German and English texts
  both present. Resolves the BKG row's carried-forward licence label.
- `opendata.dwd.de/climate_environment/CDC/Terms_of_use.pdf` — **fetched and read.** One page: CC
  BY 4.0, Status Mai 2024. The August session's two 404s were at `dwd.de/DE/service/copyright/…`;
  the working equivalent is `dwd.de/copyright`, which redirects to
  `dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html` (also fetched and read).
- `opendata.dwd.de/…/radiation_global/DESCRIPTION_gridsgermany_annual_radiation_global_en.pdf` —
  fetched and read. Source of the version, resolution, projection, units and ±6 % uncertainty in
  §2.3; none of those figures were verified before today.
- `gdz.bkg.bund.de/index.php/default/corine-land-cover-5-ha-stand-2018-clc5-2018.html` — fetched and
  read; source of the licence statement, the exact *Quellenvermerk*, and the direct download URLs.
  `HEAD` on the UTM32 shapefile confirmed size and `Last-Modified`, pinning the artefact.
- `opendatacommons.org/licenses/odbl/1-0/` — **the ODbL legal code itself fetched and read**, not
  the `openstreetmap.org/copyright` summary. This is what corrected the August session's
  produced-work assumption; see §4.
- `openstreetmap.org/copyright` — re-read; unchanged in substance from August. Note that its own
  summary says "If you alter or build upon our data, you may distribute the result only under the
  same license", which is closer to §4's reading than to August's note.
- `gdk.gdi-de.org/gdi-de/srv/ger/csw` (GDI-DE catalogue, CSW 2.0.2) — used as the route around the
  BfN 403. ISO 19139 records for *Naturschutzgebiete Deutschland*, *Landschaftsschutzgebiete
  Deutschland* and *Nationalparke Deutschland*, all published by BfN, all carrying
  `geonutz/20130319`, the *Quellenvermerk* template, "Es gelten keine Zugriffsbeschränkungen", and
  "Nicht für Planungszwecke geeignet". A broader query for records referencing
  `geodienste.bfn.de` matched 289 records; of the 20 returned and inspected, 18 carry GeoNutzV and
  2 carry `dl-de/by-2-0` — both attribution-only licences, but the per-dataset record is what
  governs, so the three above were checked individually rather than generalized from the sample.

**Two kinds of unreachability, distinguished** — they have different remedies and should not be
conflated by a later session:

- `geodienste.bfn.de` — **HTTP 403 from BfN's own server** (a BfN-branded "403 – Zugriff verweigert"
  page), on `/ogc/wfs/schutzgebiet`, `/schutzgebiete` and the host root, with and without a browser
  `User-Agent`. The CONNECT tunnel succeeds; BfN refuses the request. The identical GetCapabilities
  request succeeded on 2026-08-22, so this is a change at BfN (or a WAF reacting to this network),
  not a permanent property of the service. Retry from a different network before concluding
  anything.
- `download.geofabrik.de` and `mis.bfn.de` — **blocked by this environment's own network policy**
  (the egress gateway answers 502 to CONNECT). Nothing to do with the publishers. Note that
  `ingest/basemap/build.sh` fetches its OSM extract from `download.geofabrik.de`, and that this
  fetch **succeeded during the `0.3.0` session** — so the basemap build is not broken, it is
  unrunnable from here today.

### 2026-08-22, Phase 2 architecture session

Superseded in substance by the entries above; retained so the record of what was tried is not lost.

- `openstreetmap.org/copyright` — fetched successfully. Confirmed ODbL permits copying, adapting
  and redistributing with attribution. The session's further conclusion, that a derived criterion
  value is a "produced work" outside share-alike, **was an assumption and is corrected in §4**.
- `govdata.de/dl-de/by-2-0` and `govdata.de/dl-de/by-2-0.txt` — both HTTP 503. Resolved 2026-09-18.
- `geodienste.bfn.de/ogc/wfs/schutzgebiet` — fetched successfully. The capabilities document cites
  GeoNutzV, **not** `dl-de/by-2-0` as an earlier draft assumed, and states "Nicht für Planungszwecke
  geeignet". Both findings stand and are now corroborated by the datasets' metadata records.
- `gesetze-im-internet.de/geonutzv/index.html` — fetched, but returned only the table of contents.
  Resolved 2026-09-18 at the `BJNR054700013.html` URL.
- `dwd.de/DE/service/copyright/copyright_node.html` and `…/copyright_artikel.html` — both HTTP 404.
  Resolved 2026-09-18 at `dwd.de/copyright`.

---

## 7. What "Confirmed" requires before real ingest

Unchanged as a standard; §1 records how far each row has got against it.

1. The licence terms are read in full at the publisher's own current terms page (not inferred from
   a licence family name). — **Met for all four rows as of 2026-09-18.**
2. Whether *derived, aggregated, or scored* outputs may be published — not only the raw data — is
   explicitly confirmed. This is the distinction U7 (`docs/product/mvp.md` §9) exists to close, and
   it is not the same question as "is the raw data open." — **Met for BfN, BKG and DWD. For OSM the
   answer is "yes, with share-alike attached", which is why §4 is a decision and not a status.**
3. The retrieval date and exact version/extract used for the pilot region are recorded here,
   replacing the "vintage not yet pinned" placeholders. — **Met for BKG and DWD, and as of
   2026-09-19 no longer only on paper: both have been fetched, and every artefact's sha256 and
   upstream `Last-Modified` is recorded in `data/raw/<source_id>/fetch-provenance.json`. Not met
   for BfN (403) or OSM (Geofabrik unreachable).**

A fourth condition is added by §3 of this document, because it was not previously written down and
is what turns a cleared licence into a lawful deployment:

4. The source's required attribution string is implemented in the interface and in every export
   before the data reaches a public screen — not added later. — **Met, 2026-09-19.** The notice is
   no longer something a renderer has to remember:

   - `source.attribution` is a **`NOT NULL`** column with a non-blank `CHECK` (migration
     `0003_source_attribution.sql`), alongside `attribution_url` and `change_notice_required`. A
     source whose notice was never recorded cannot be inserted, so `design-language.md` §7's
     binding rule — *a card that cannot cite itself must not render* — is enforced at the schema
     rather than at render time on somebody's screenshot.
   - The three fetched sources are seeded with their verified notices in
     `ingest/seed_real_sources.sql`, each carrying `<Jahr>` as a placeholder resolved from
     `retrieved_at` — not from today's date, because the licences ask for the year of last data
     retrieval and a pinned artefact's does not change with the calendar.
   - `lib/attribution.ts` renders them and refuses the uncitable; the scenario-card export returns
     **422 naming the offending source ids** rather than producing an uncited image; the criterion
     evidence view shows the *Quellenvermerk* as its own field beside the licence name; and the map
     carries both the basemap's notice and the pilot boundary's, which are different sources under
     different licences.

   Note that BKG's metadata gives the CLC5-2018 *Quellenvermerk* as
   `© GeoBasis-DE / BKG (Jahr des Datenbezugs)` where §3 of this document records the generic
   `(Jahr des letzten Datenbezugs)` wording; the 2021 record uses the latter. Use the wording from
   the record for the version actually ingested.

   **As of 2026-09-23 it covers real data.** The Uckermark's `criterion_value` rows are derived
   from CLC5, DWD, DGM200 and LfU Brandenburg, and the explorer's attribution control credits every
   source whose values reach the map, each with its change notice (`app/(map)/page.tsx`). Exports
   of real-region scenario cards are untested: the real region has no outcome rows yet.

---

## 8. Candidates not yet in this table

`docs/product/mvp.md` §4 names additional criteria (soil quality / *Bodenzahl* / *Ackerzahl*,
species-sensitivity data for wind, statutory setback distances) whose specific source datasets have
not yet been identified. These are not silently assumed available — they remain open, tracked
against U2 and U4, and will be added as rows once a candidate source is found and its licence
checked, not before.

§4(b) added one to the list on 2026-09-18: **a non-ODbL settlement-geometry dataset**. That item is
**closed as research** by §4.1 — two candidates exist (`BKG CLC5` classes 111/112 under
`dl-de/by-2-0`, and `BKG DLM250` layer `SIE01_F` under GeoNutzV) and their limitations are
documented. Neither becomes a row here until §4 is decided, because neither is needed unless it is.

The 2026-09-24 research (U2) adds these, all recorded rather than adopted:

- **LfU *Biotopkataster* (BBK)** — `https://inspire.brandenburg.de/services/bbk_wfs`
  (`app:bbk_fl`, `app:bbk_li`, `app:bbk_pu`), `dl-de/by-2-0`, *"© Landesamt für Umwelt
  Brandenburg"*. **Selective, not complete**: fully mapped only in FFH areas and large protected
  areas; elsewhere only protected biotopes and FFH habitat types. Attributes include `biotyp`,
  `ffhlrt`, `ffhges`, `datum_e` (Uckermark polygons dated 1993–2025). The service metadata also
  carries an INSPIRE Art. 13(1)(e) restriction note, which needs clarifying with LfU before use.
  **The source for the categorical nature-capital view** (`scoring-criteria.md` §4.3), in a
  later change.
- **CIR-BTLN 2009** — complete biotope and land-use mapping of Brandenburg from 2009 colour-infrared
  imagery, 1:10 000, `data.geobasis-bb.de/geofachdaten/Natur_und_Landschaft/Biotope_und_Lebensraumtypen/cir_btln_fl.zip`.
  The directory states `dl-de/by-2-0` with *"Bereitsteller: GeoBasis-DE / LGB"*, which differs from
  LfU as the expected provider — to resolve. Seventeen years old.
- **BGR BÜK200, GWN1000** — **not usable for public outputs as things stand**: BGR's AGB §3 says
  *"Nicht übertragen wird insbesondere das Recht der öffentlichen Zugänglichmachung"*, unless
  GeoNutzV applies to the dataset, which needs a legal answer. GWN1000 is also 1 km and 1961–1990.
- **BKompV Anlage 2** — a legal points scale for biotopes (0–24), but applicable only where federal
  authorities carry out the *Eingriffsregelung* (§ 1 Abs. 1 BKompV). Not adopted, by the owner's
  decision of 2026-09-24 (`scoring-criteria.md` §4.3).
- **LfU *Sensible Moore* 2008** — locations and catchments of acid, transition and spring mires;
  a possible flag for high-value peat. Licence not yet read.

§4.1 adds two further candidates, both recorded rather than adopted:

- **basemap.de Web Vektor** (BKG, **CC BY 4.0**) — a possible non-OSM basemap. ADR-0003 change, §3-gated.
- **CLC5-2021** (BKG, `dl-de/by-2-0`) — a three-year-newer version of a dataset sela already uses.
  Source-version change, §3-gated. See §6.
