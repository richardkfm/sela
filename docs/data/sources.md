# Data source inventory

**Version band:** `0.2.x` · **Status:** licence terms now read in full for all four datasets — see §1 · **Last updated:** 2026-09-18

This is the gate `docs/architecture/roadmap-to-first-deployment.md` §2.2 and §3.1 requires before
any dataset enters ingestion: `CLAUDE.md` §5 forbids asserting a licence that has not been
verified, and no dataset below may be used in real ingestion until its **Status** column says so.

Nothing in this table states a coverage, resolution, or licence beyond what has actually been
read at the source cited. Where that has not happened, the row says so.

---

## 1. Status at a glance

| Dataset | Licence | Derived outputs publishable? | Ingest gate |
|---|---|---|---|
| BfN Schutzgebiete | GeoNutzV | **Yes**, with attribution + change notice | **Licence cleared; access blocked** — `geodienste.bfn.de` returns 403 to this environment (§6) |
| BKG CORINE Land Cover 5 ha (CLC5-2018) | `dl-de/by-2-0` | **Yes**, with attribution + change notice | **Licence cleared; version pinned** (§2.2) |
| DWD CDC annual global radiation grids | CC BY 4.0 | **Yes**, with attribution + change notice | **Licence cleared; version pinned** (§2.3) |
| OpenStreetMap via Geofabrik | ODbL 1.0 | **Yes, but share-alike may attach to sela's own database** | **Open decision — §4.** Geofabrik also unreachable from this environment (§6) |

**None of these rows flips the machine gate on its own.** `ingest/sources.manifest.json` — which
`ingest/01_fetch.sh` actually reads before touching a network — is deliberately left at
`to_confirm`/`unconfirmed` by the session that wrote this document. Allowing real ingestion is a
`CLAUDE.md` §3 decision (data sources and licensing), and this document is the evidence for that
conversation, not a substitute for it. The two files must be changed together, in the change that
takes that decision.

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
| Pinned artefact | `https://daten.gdz.bkg.bund.de/produkte/dlm/clc5_2018/aktuell/clc5_2018.utm32s.shape.zip` — 1 361 366 128 bytes, `Last-Modified: Fri, 25 Mar 2022 13:15:09 GMT` (verified by HTTP HEAD, 2026-09-18). GK3 and TM32 variants exist at the same path; **UTM32S is the one to take** — it matches ADR-0002's EPSG:25832 storage, so no reprojection step is needed. |
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
| Pinned artefacts | `https://opendata.dwd.de/climate_environment/CDC/grids_germany/annual/radiation_global/` — annual files `grids_germany_annual_radiation_global_{1991..2025}.zip` present; the 2025 file is dated 2026-01-15. The directory is extended around February with the previous year. |
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
| BKG | `© GeoBasis-DE / BKG (<Jahr des letzten Datenbezugs>) dl-de/by-2-0` | BKG requires that, **on a web page**, "BKG" is hyperlinked to `https://www.bkg.bund.de` and "dl-de/by-2-0" to `https://www.govdata.de/dl-de/by-2-0`, that the notice is clearly visible on any public display, distribution, presentation or external use, and that a change notice accompanies any edited or transformed use. |
| DWD | `Quelle: Deutscher Wetterdienst` (text form; the DWD logo is an accepted alternative) | Per §7 DWD-Gesetz. To be placed **immediately at the DWD information used**. For substantial modification DWD expects at minimum to be named in a central source list or the Impressum, together with a change notice — DWD's own examples include *"Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt"*, which is precisely what sampling a 1 km grid onto hex cells is. The dataset additionally carries its own required citation: `DWD Climate Data Center (CDC): Gridded annual sum of incoming shortwave radiation (global radiation) on the horizontal plain for Germany based on ground and satellite measurements, Version V003, <current year>.` |
| OSM | `© OpenStreetMap contributors` with the data made clear to be available under the Open Database License — linking to `https://www.openstreetmap.org/copyright` satisfies the latter for a browsable map; printed works must carry the full URL | ADR-0003 already records this as a standing duty on **every screen and every export**. Distributing OSM in data form requires naming and linking the licence directly. |

A practical consequence for `docs/product/design-language.md` §7: the provenance footer must be
able to render a per-source notice with a hyperlink and a change notice, not a single flat credit
line. Whether that fits the current card layout has not been checked — it is user-visible
behaviour and therefore §3-gated; recorded here rather than silently designed.

---

## 4. Open decision — ODbL share-alike and sela's own database

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

This document does not choose. It records that **choosing (a) or (b) is a precondition for
`wind_settlement_setback` entering ingestion**, and that the basemap path is unaffected by the
choice.

---

## 5. Open item — "Nicht für Planungszwecke geeignet"

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

---

## 6. Verification log

Entries record what was actually fetched and read, so a later session does not repeat a dead end or
mistake an attempt for a confirmation.

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
   replacing the "vintage not yet pinned" placeholders. — **Met for BKG and DWD. Not met for BfN
   (403) or OSM (Geofabrik unreachable).**

A fourth condition is added by §3 of this document, because it was not previously written down and
is what turns a cleared licence into a lawful deployment:

4. The source's required attribution string is implemented in the interface and in every export
   before the data reaches a public screen — not added later.

---

## 8. Candidates not yet in this table

`docs/product/mvp.md` §4 names additional criteria (soil quality / *Bodenzahl* / *Ackerzahl*,
species-sensitivity data for wind, statutory setback distances) whose specific source datasets have
not yet been identified. These are not silently assumed available — they remain open, tracked
against U2 and U4, and will be added as rows once a candidate source is found and its licence
checked, not before.

§4(b) adds one to the list: **a non-ODbL settlement-geometry dataset**, needed only if the decision
in §4 goes that way.
