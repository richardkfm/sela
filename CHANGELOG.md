# Changelog

All notable changes to sela are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the version ladder described below.

---

## Versioning approach

Pre-1.0 versions carry meaning in this project. The minor version states which layer of the project is being built; the patch version tracks increments within it.

| Band | Meaning | Done when |
|---|---|---|
| `0.1.x` | **Planning and documentation** — mission, scope, product principles, design language, open questions | The MVP is defined well enough that domain modelling can start without re-litigating scope |
| `0.2.x` | **Domain model and architecture** — glossary, scenario semantics, scoring criteria, data inventory, ADRs | The spatial unit, data sources, and system shape are decided and recorded |
| `0.3.x` | **MVP foundations** — data ingestion for a pilot region, scoring prototype, first UI | A real parcel can be compared across all four scenarios, end to end |
| `1.0.0` | **First stable public MVP** — published method, disclaimers, shareable outputs, performance | It can be handed to a municipality and to the public without a caveat about readiness |

Breaking changes to public interfaces, scoring semantics, or data contracts are called out under `### Changed` with a `**BREAKING:**` prefix, in every band including pre-1.0.

---

## [Unreleased]

### Added

- **Nature capital, phase 3: the cited climate and water results reach the screens.** Asked for
  by the project owner ("yes start it") and confirmed through the `CLAUDE.md` §3 gate on
  2026-09-25 with the proposals as written: water under `restore` **not modelled**; a change
  between ranged values shown as **"Δ der Mittelwerte"** beside both ranges; the energy chart
  **hidden** where no energy is modelled; the note text for the comparison of real land; and the
  measure names *Kohlenstoffvorrat im Moorboden*, *Treibhausgasbilanz des Moorbodens*,
  *Versickerung*, *Bodenfeuchte im Wurzelraum*.
  - **Scenario comparison** (`app/unit/[id]/compare`) reads the illustrative rows and every cited
    method (`peat-climate-ipcc2013-v1`, `water-arcegmo-v2`); a cited method's rows replace the
    illustrative placeholder of their dimension. One row per measure, grouped by dimension. Three
    states: a value, ***Trifft nicht zu*** with the method's one-line reason (plain text), and
    *Noch nicht modelliert* (the dashed badge). A ranged value shows its range ("28 bis 47
    t CO₂-Äq./ha·a") with the central value below it. Every value carries the confidence glyph;
    the caption decodes it. Rounding: whole units for t C/ha, mm/a and %nFK; two significant
    figures for the Tier 1 balance.
  - **"Woher kommen diese Zahlen?"** under the table: per cited measure, its method (linked to the
    method page), what its range means, and the criterion values it was computed from
    (`outcome_input`) with their confidence and *Quellenvermerk*.
  - **Method page:** a section *Wie die Ergebnisse berechnet werden*, one entry per cited method
    from its stored `outcome_method` row — description, citation, measures, what *trifft nicht
    zu* and the range mean, and, folded, every setting and factor with its 95 % interval and
    table and page.
  - `lib/scoring/outcome-display.ts` (the rows, cells, rounding and delta text, pure and tested in
    `outcome-display.test.ts`), `lib/scoring/labels.ts`, `components/NotApplicableBadge.tsx`, a
    compact `ConfidenceMark`; `OutcomeMethod.metrics` names each measure and its reasons.
  - Verified on the local Uckermark database: arable, grassland and no-peat cells render as
    described; axe (WCAG 2 A/AA) passes on the comparison, parcel and method pages in light mode.

- **Nature capital, phase 2: real `preserve` and `restore` numbers for the Uckermark, computed and
  traceable (data and computation only; the screens are the next change).** Scoped by the project
  owner on 2026-09-24: the §4 proposals confirmed as written, unverifiable inputs left
  *noch nicht modelliert*, and this change limited to data and computation.
  - **Migration `0005_outcome_provenance.sql`** (ADR-0008): `outcome.metric`, `value_low` /
    `value_high`, the `not_applicable` status, and the tables `outcome_method` and
    `outcome_input`. ADR-0008 is amended where implementation contradicted it: no foreign key
    from `outcome.method_version` (the illustrative rows have no method to point to).
  - **`lib/scoring/nature/`** — `peat-climate-ipcc2013-v1` (carbon stock and annual balance,
    IPCC 2013 Tier 1, AR5 GWP 28/265) and `water-arcegmo-v1` (percolation, root-zone moisture,
    and the labelled restore approximation), pure functions with every factor cited to table and
    page; the factors are written to `outcome_method` from the same code.
  - **Ingest:** `15_moorkarte.sh`, `16_wasserhaushalt.sh`, `20b_sample_nature.sql`,
    `seed_nature_criteria.sql`; `run.sh` fetches and runs them. Outcome inputs carry weight 0
    and apply to scenarios, so the suitability engine and the method page's weighted table leave
    them out.
  - **`pnpm db:materialize`** writes the cited methods by default for real regions
    (`--outcomes=methods`), streaming ~1.4 million rows per method with their `outcome_input`
    links in one transaction each.
  - Verification items V1–V3 and V5 closed at primary sources; **V4 (the depth basis of LBGR's
    carbon stock) is still open**, so the stock stays at `medium` confidence.
  - Tests: `lib/scoring/__tests__/nature.test.ts`, and new cases in `outcomes.test.ts`.
  - **First run on the Uckermark** (117 191 cells, ingest ≈ 11 min, materialise ≈ 5 min):
    peat balance modelled for 17 567 cells (peat under arable land or grassland), *trifft nicht
    zu* for 87 267, *noch nicht modelliert* for 12 357 (peat under other land cover, or only
    Moor-/Anmoorgley); carbon stock for 34 802 cells; water balance for every cell, the restore
    approximation for the 17 567. No modelled outcome is without `outcome_input` rows.
  - **Open for the owner:** the water restore approximation rests on only 58 *feuchte Moore*
    areas, mostly on groundwater-far hydrotopes, and shows rewetting *raising* percolation
    (median ≈ 145 mm/a against ≈ 68 mm/a on average). `docs/domain/scoring-criteria.md` §4.2
    asks whether it should be shown at all.

- **Nature capital, phase 1: the method is written down, not yet run (U2 partly closed).** Asked
  for by the project owner as the next step after the real Uckermark ingest, and scoped through the
  `CLAUDE.md` §3 gate on 2026-09-24 in two rounds of questions. Decided: **climate and water**
  first; `preserve` shows the **carbon stock that stays in the ground**; a third outcome state,
  ***trifft nicht zu***; outcomes carry their provenance; habitat shown as **categories, no points
  scale**; climate as **two measures in every scenario** (stock and annual balance); water under
  `restore` as a labelled **approximation**; **IPCC 2013 Tier 1** factors; grassland on peat as a
  **range** between shallow- and deep-drained.
  - `docs/domain/scoring-criteria.md` §4 — the methods `peat-climate-ipcc2013-v1` and
    `water-arcegmo-v1`, every factor with its table and page, the decisions D1–D9, the proposals
    still open to review, and six verification items (V1–V6) owed before any number is computed.
  - **ADR-0008** — `outcome.metric`, a value range, the `not_applicable` status, and
    `outcome_method` / `outcome_input` so every outcome reaches its criterion values and sources.
  - `docs/data/sources.md` §2.9–§2.11 — **LBGR *Moorbodenkarte*** (WFS, `dl-de/by-2-0`) and **LfU
    ArcEGMO water balance 1991–2020** (`dl-de/by-2-0`), both **Confirmed, not yet fetched**, with
    their attribution strings; the IPCC Wetlands Supplement as the cited method. Biotope sources,
    BGR and BKompV recorded in §8 as considered and not adopted.
  - `ingest/sources.manifest.json` — the two sources as `confirmed`, with fetch blocks. `run.sh`
    does not fetch them yet; that comes with the ingest steps.
  - Glossary terms for the new states and measures; U2 status in `mvp.md` and the roadmap.

- **The real Uckermark ingest — the first map of real land.** Asked for by the project owner
  ("do the real Uckermark ingest next") and scoped through the `CLAUDE.md` §3 gate on 2026-09-23:
  **criteria land cover (CLC5), slope (DGM200) and irradiation (DWD); protection areas from a
  researched Brandenburg source; vector tiles from PostGIS; and illustrative verdicts on the real
  values** (the owner chose this over showing measured values only). `ingest/run.sh` now runs end
  to end for `uckermark-12073`: 117 191 hex cells, `criterion_value` rows for all four criteria,
  and verdicts for PV and Agri-PV (72 309 *geeignet*, 26 519 *nicht geeignet*, 18 363
  *ausgeschlossen*).
- **Two new sources, both `dl-de/by-2-0`** (`docs/data/sources.md` §2.7, §2.8):
  **BKG DGM200** for `pv_slope`, pinned by the publisher's md5 because the host serves two
  different `Last-Modified` values for the same bytes; and **LfU Brandenburg Schutzgebiete**
  (`inspire.brandenburg.de/services/schutzg_wfs`) in place of BfN's service, which still returns
  403. `01_fetch.sh` gained a `wfs` kind and an optional `publisherMd5` check.
- **`ingest/real/`** — boundary, CLC5, DWD (ten annual grids, sampled in their native
  Gauß-Krüger projection), DGM200 slope and protection areas into `staging`, then per-cell
  sampling (≈ 75 s for the whole Landkreis) and `criterion_value` rows with a stated confidence
  per criterion. `seed_real_criteria.sql` holds the `illustrative-real-v0` definitions.
- **ADR-0007 — units reach the map as vector tiles cut by PostGIS**
  (`/api/units/tiles/{z}/{x}/{y}`, `ST_AsMVT`, a generated `geom_3857` column in migration
  `0004_tile_geometry.sql`). Tiles carry only verdict colours below z12 and ids and scores from
  z12, where a cell is large enough to select; a z12 tile is ≈ 46 KB.
- **Region-aware interface.** `/?region=` opens any ingested region; the default is the Uckermark,
  falling back to the fixture. The *ILLUSTRATIV* banner has a second wording for real regions —
  *real measurements, placeholder weighting* — on the explorer, unit, comparison, criterion, method
  and 3D-preview pages. The unit page lists its **measured values** with unit, source, licence and
  confidence (`lib/scoring/format-value.ts`; CLC classes by their documented German names,
  `lib/scoring/clc-classes.ts`). The explorer's attribution credits every source whose values
  reach the map, each with its change notice.
- Unit tests for reading real values (`lib/scoring/__tests__/real-criteria.test.ts`); e2e tests
  for the tile route (`tests/e2e/tiles.spec.ts`).

### Fixed

- **`06_write_criterion_values.sql` wrote every region's samples** as the fixture's values.
  `staging.raw_sample` is shared with the real pipeline, so a fixture run after a real ingest on
  the same database copied all ~1.26 million real values a second time under `fixture-v0` with a
  flat `medium` confidence, and the unit page listed each value twice. The step now takes
  `pilot_region` and writes only that region's samples. Present since `0.2.1`; found while testing
  this change.

### Changed

- **BREAKING (scoring): water under `restore` is no longer modelled — `water-arcegmo-v2`
  replaces `water-arcegmo-v1`.** Decided by the project owner on 2026-09-25. The v1
  approximation rested on 58 *feuchte Moore* areas, mostly groundwater-far, and showed rewetting
  raising percolation, which is likely an artefact of that reference set. `restore` now reads
  *noch nicht modelliert* for both water measures; status quo and preserve are unchanged. The
  ingest no longer samples the wet-peatland reference, and `seed_nature_criteria.sql` removes the
  v1 outcomes and the six `water_wet_ref_*` criteria from databases ingested before.
- Parcel detail, criterion and method pages name scenarios and technologies in German under
  *gilt für* instead of printing ids such as `preserve`.

- **`computeOutcomeDelta` no longer subtracts rows of different units** (ADR-0008 §1): it returns
  no delta. The illustrative fixture's climate rows are "t CO2e/a", "… avoided" and
  "… sequestered", so **the fixture's comparison screen no longer shows climate deltas**, which
  had subtracted incomparable quantities. Rows of different metrics are refused as a caller error.
- `listCriterionValuesForPilotRegion` takes an optional list of criterion ids; the materialiser
  reads only what each step uses.
- `format-value.ts` writes t C/ha, mm/a and %nFK in whole units (no false precision).
- The suitability step reads only criteria that apply to a technology.

- **The explorer lists the units in view, not the whole region** (117 191 units would not be a
  usable keyboard list), capped at 40; below z12 it asks the reader to zoom in, and a click on the
  map zooms in instead of selecting. Legend counts come from `/api/units/stats`.
- **`07_materialize_scores.ts` writes verdicts in one transaction per region, in batches of
  5 000**, and takes `--outcomes=illustrative|none` — `none` by default for real regions, so the
  comparison shows *noch nicht modelliert* rather than invented outcomes for real land.
- **`04_generate_grid.sql` takes a per-region advisory lock.** Two concurrent runs had written the
  grid twice (234 382 duplicate cells, removed).
- `ConfidenceMark` fades only its glyph; the text stays at full contrast (axe colour-contrast).
- `.env.example`: `SELA_PILOT_REGION` replaces the unused `NEXT_PUBLIC_MAP_VIEW`.

### Open — awaiting the owner's confirmation (`docs/domain/scoring-criteria.md` §6)

- Only **Naturschutzgebiete and the Nationalpark** exclude; FFH and SPA would exclude 53 % of the
  Landkreis although Natura 2000 requires an assessment, not a ban.
- A cell counts as excluded when **at least half** of it is protected.
- The **land-cover score table** and the **irradiation bounds** (1 000–1 300 kWh/m²·a, against
  1 100–1 137 measured in the region — so irradiation is "limiting" almost everywhere).
- The Docker ingest image (`docker/Dockerfile.ingest`) gained `unzip`, `curl` and
  `postgis` (for `raster2pgsql`) but has **not been built** — there is no Docker daemon in the
  environment this was written in. The pipeline was run with the same tools installed locally.

### Added — 3D parcel preview and explorer polish (PR #9)

- **A proper map view, and a 3D parcel preview — `docs/architecture/adr-0006-3d-parcel-preview.md`.**
  Asked for by the project owner ("make it look really good and innovative … geospatial map apps
  that use 3D models on top of the map"). Because `design-language.md` §2 bans 3D marks, every
  choice below went through the `CLAUDE.md` §3 gate first, in two rounds of questions on
  2026-09-23: **the explorer stays a flat 2D map; selecting a unit opens a separate 3D preview;
  it shows true-scale scenario models and cited setback rings; rendered with deck.gl over
  MapLibre; terrain from researched open data, DEM only.** The owner explicitly declined
  extruding units by score — so **no number sela computes is ever drawn as height.**
- **The explorer, rebuilt map-first** (`app/(map)/Explorer.tsx`, `Legend.tsx`,
  `SelectionPanel.tsx`, `components/TechnologySwitch.tsx`). Full-bleed map with one quiet panel:
  masthead, the *ILLUSTRATIV* note, a technology switch whose buttons carry their own hatched
  swatches, a legend that is also the first table view (count per class on one shared axis), and
  the keyboard-reachable unit list. Selecting a unit — by click or from the list — frames it and
  opens a card with **all three technologies side by side**, each with its limiting or excluding
  criterion linked to the evidence view; the one accent action is *Szenarien vergleichen*. Hover
  shows a tooltip; Escape clears the selection; focus moves to the card for keyboard and
  screen-reader users.
- **Patterns on the map itself** (`lib/map/patterns.ts`, `lib/map/verdict-style.ts`). Until now
  only the legend-style swatches carried hatches; on the canvas, amber against grey carried the
  verdict alone. Suitable units now carry their technology's hatch (45°, crosshatch, 135°) and
  excluded units a horizontal hatch, drawn as MapLibre `fill-pattern` images generated from the
  same encodings as the CSS classes. A new e2e test converts a real screenshot of the map to
  greyscale and checks the hatch survives.
- **`/unit/[id]/preview` — the 3D parcel preview.** Wind: a procedural reference turbine
  (hub height and rotor diameter on sliders, default 160 m / 160 m, labelled *illustrativ*),
  its total height, and two rings around the mast foot — **2 H per § 249 Abs. 10 BauGB** (dashed,
  a *Regelvermutung*) and **1 000 m per § 1 BbgWEAAbG** — each with its quoted wording, measuring
  point and limits. Views from eye height on either ring, from N/O/S/W, with the rotor turned to
  face the viewer and the caveat beside the button that buildings and vegetation are missing:
  *"Das ist keine Sichtbarkeitsanalyse."* PV and Agri-PV: module rows clipped to the unit with a
  boundary inset, Agri-PV raised on supports at 4.5 m clearance. *Ist-Zustand* shows the unit
  without an installation and points to the comparison for what preserve and restore mean there.
- **Geometry for the preview stays in PostGIS** (`lib/db/queries/preview.ts`,
  `/api/unit/[id]/preview`) — ADR-0002's "TypeScript never computes geometry" holds for display
  geometry too: row layout in EPSG:25832, rings and viewpoints on `geography`. TypeScript builds
  meshes in model space (`lib/preview/meshes.ts`) and reads ground height back from the displayed
  terrain for placement only. `/api/unit/[id]/summary` feeds the selection card; unit features now
  carry `bbox` and `areaHa` from PostGIS so the client can frame a unit without measuring it.
- **Terrain: BKG basemap.de 3D Gelände (DGM5)** for the preview only (`lib/basemap/terrain-source.ts`,
  `/api/tiles/style.json?terrain=1`, `SELA_TERRAIN`), at exaggeration 1. Verified against the live
  service rather than its documentation: **512 px tiles** (the product page says 256), Mapbox
  terrain-RGB encoding (decoded 17.8–80.6 m over the Uckermark), z ≤ 15, CORS open.
- **Unit tests** for the preview's sizes and the map's encodings (12 new, 47 total) and **e2e
  tests** for the new flows: keyboard selection → card → detail, the technology switch, the
  preview's sliders and cited links, axe on the explorer with a selection and on the preview in
  all four scenarios, and the map greyscale check (16 e2e total, all passing).

- **U7 is closed. `docs/architecture/adr-0005-osm-free-stack.md` takes OpenStreetMap out of sela.**
  The ODbL question open since 2026-09-18 is decided as **option (b)**, taken further than option
  (b) was originally written: basemap.de (CC BY 4.0) for the map, BKG CLC5 classes **111/112**
  (`dl-de/by-2-0`) for settlement geometry, class 121 *Industrie- und Gewerbeflächen* explicitly
  excluded because a setback to *Wohnbebauung* is not a setback to an industrial estate. No
  share-alike term touches sela's scoring database and ODbL §4.6's machine-readable-access duty
  never attaches — to the database or to the scenario cards derived from it. The reasoning, stated
  in the ADR: a **perpetual, irreversible licence obligation on the whole database** is a larger
  cost than a **documented accuracy limit on one criterion**, and `CLAUDE.md` §4.5 requires that
  limit to be shown in the interface anyway. `osm-geofabrik` is **`withdrawn`** in the manifest —
  not unconfirmed, deliberately unused — and re-confirming it means reopening the ADR.
- **`pv_irradiation_annual` gets a decided year window: a 10-year trailing mean, 2016–2025**
  (`docs/data/sources.md` §5.2, machine-readable in the manifest's `dwd-cdc-radiation.aggregation`).
  Decided **against the data**, not by argument: every fetched grid was reduced to a Germany-wide
  mean over 359 586 valid 1 km cells. Global radiation is trending **+3.35 kWh/m² per year** across
  1991–2025, which makes the WMO 1991–2020 normal sit **5.4 % below** the last decade — a
  systematic low bias as large as DWD's own ±6 % method uncertainty, applied to every parcel. A
  single year is worse still: the record spans 995.9 (1998) to 1 227.4 (2022) kWh/m², so the choice
  of year could move a solar verdict by 23 %. Ten years puts the sampling term at 1.5 % while still
  tracking the trend. **And the confidence figure is now derived rather than copied:** √(6² + 1.5²)
  ≈ 6.2 %, so the criterion carries ±6 % because the work was done.
- **Attribution is structurally required — `docs/data/sources.md` §7 condition 4 is met.** Migration
  `0003_source_attribution.sql` adds `source.attribution` as **`NOT NULL`** with a non-blank
  `CHECK`, plus `attribution_url` and `change_notice_required`. Storing the licence *name* was never
  enough: `dl-de/by-2-0`, GeoNutzV and CC BY 4.0 each demand specific wording, and BKG alone needs
  `© GeoBasis-DE / BKG <Jahr>` for CLC5 and `© BKG <Jahr>` for VG25. Making the notice a schema
  constraint means `design-language.md` §7's binding rule — *a card that cannot cite itself must not
  render* — is enforced where a source is created rather than at render time on somebody's
  screenshot.
- **`lib/attribution.ts`, `components/SourceAttribution.tsx`, `ingest/seed_real_sources.sql`** and 8
  tests. `<Jahr>` resolves from the source's own `retrieved_at`, **not** today's date — the licences
  ask for the year of last data retrieval and a pinned artefact's does not change with the calendar.
  The scenario-card export now returns **422 naming the offending source ids** rather than rendering
  an uncited image; the criterion evidence view shows the *Quellenvermerk* as its own field beside
  the licence name; and the map carries the pilot boundary's notice as well as the basemap's, which
  are different sources under different licences.

- **The map shows real geography.** At the project owner's request ("use the carto tiles for now so
  we can see something"), the explorer now renders a remote basemap and the real pilot-region
  outline instead of synthetic cells at null island. `lib/basemap/basemap-source.ts` is the single
  place that decides which basemap is serving and what attribution comes with it — one module so
  the live map (`app/api/tiles/style.json`) and the export card
  (`app/api/unit/[id]/card/route.tsx`) cannot drift apart on a credit line that ADR-0003 makes
  mandatory on both.
- **The fallback is basemap.de, not CARTO, because CARTO was tested and found watermarked.**
  Rendering the CARTO configuration in a real browser returned 49/49 tiles — each stamped
  *"API KEY REQUIRED"* diagonally across it. `richardkfm/alpha`'s setup no longer yields a clean
  map without an account. BKG's **basemap.de** WMTS does: no key, 49/49 clean tiles, **CC BY 4.0**
  with no share-alike (already verified in `docs/data/sources.md` §4.1), and its `_grau` style is
  the match for `design-language.md` §4.1's desaturated requirement. CARTO stays selectable behind
  `SELA_BASEMAP=carto` for anyone holding a key.
- **`SELA_BASEMAP`** (`auto` | `pmtiles` | `basemapde` | `carto` | `none`) and
  `NEXT_PUBLIC_MAP_VIEW=fixture`, both documented in `.env.example`. `auto` prefers the ADR-0003
  archive whenever one exists and only falls back when it does not, so building the archive changes
  nothing else. The fixture view is kept reachable rather than deleted — the `0.3.0` scoring demo
  still works, it simply is not the default now that there is real geography to show.
- **`ingest/02c_pilot_boundary_display.sh` and `public/pilot-uckermark.geojson`** — a display-only
  boundary, simplified at 25 m and reprojected to EPSG:4326 (12 733 → 1 355 vertices, 673 KB → 30 KB).
  Explicitly **not** an analysis input: `04_generate_grid.sql` clips against the full-precision
  EPSG:25832 file, because a simplified boundary would silently add and drop cells along the edge.

- **The pilot region is decided: Landkreis Uckermark** (AGS `12073`, NUTS `DE40I`), delegated to
  this session by the project owner. `docs/architecture/roadmap-to-first-deployment.md` §2.3 stops
  being a stated assumption and becomes a decision, with the grounds written down: all four
  scenarios have real content there, its boundary is a single ring with no exclaves or holes, and
  it is the **largest** Brandenburg *Landkreis* at **3 082.4 km²** — measured from the boundary
  geometry itself, not looked up. That size is the one real cost: ≈ 118 600 hex cells at
  `ST_HexagonGrid(100, …)` against ≈ 47 000 for the smallest district. The claims about wind
  build-out, protected areas and peatland that motivate the choice are recorded explicitly as
  *rationale, not findings* — none is measured yet, BfN is still returning 403, and `CLAUDE.md` §5
  forbids anything downstream citing them as evidence.
- **`ingest/pilot/`** — the real boundary (`uckermark-12073.geojson`, EPSG:25832, 12 733 vertices,
  rounded to 0.01 m because VG25 is a 1:25 000 product) plus a README covering the region, its
  measured extent, the mandatory attribution and how to cut a different *Landkreis*. Committed
  rather than generated so the pipeline runs without the 325 MB fetch.
- **`ingest/02b_extract_pilot_boundary.sh`** — the reproducible `ogr2ogr` path for that extraction,
  parameterised by AGS. **It has not been executed**: GDAL is not installed in this environment, so
  the committed GeoJSON came from a one-off GeoPackage reader instead. Flagged in the README and
  the verification log — diff the two before trusting either.
- **A fifth dataset: BKG VG25** (*Verwaltungsgebiete 1:25 000*), fetched and checksummed, Produktstand
  31.12.2025. Chosen over VG250 because 1:25 000 is the precision a 100 m grid deserves, and over
  the GK3/shape variants because the UTM32S GeoPackage is already EPSG:25832 — confirmed from the
  GeoPackage's own `srs_id`, not from the filename.
- **`docs/data/sources.md` §2.5 records a near-miss worth keeping.** VG25 is **CC BY 4.0**, *not*
  `dl-de/by-2-0` like BKG's CLC5 — same publisher, same host, one directory across, different
  licence. The manifest entry was first written as `dl-de/by-2-0` by analogy and corrected only
  after reading `nutzungsbedingungen_vg25.pdf` **inside the archive**. Its *Quellenvermerk* also
  differs: `© BKG …`, without CLC5's `GeoBasis-DE /` prefix. §3 now carries both, separately.
- **A third basemap option, from sela's own prior art.** `richardkfm/alpha` used hosted CARTO
  raster tiles (`basemaps.cartocdn.com`), attributed "© OpenStreetMap © CARTO". Recorded in §4.1
  with its trade-offs: no build pipeline and no archive, but a third-party dependency of exactly
  the shape ADR-0003 rejected, and raster where the design language wants restylable vector. It
  does **not** change the §4 decision — a hosted basemap never puts OSM data into `criterion_value`,
  and that is the leg share-alike turns on.

- **The first real data sela has ever fetched.** `ingest/01_fetch.sh` gained working fetch
  implementations and was run for both confirmed sources: the pinned BKG CLC5-2018 shapefile
  archive (1 361 366 128 bytes — the `HEAD` pin recorded on 2026-09-18 still matches exactly) and
  the **complete** DWD annual global radiation series 1991–2025 (35 grids plus both description
  PDFs, 37 artefacts). Everything lands in git-ignored `data/raw/<source_id>/` alongside a
  `fetch-provenance.json` recording the retrieval time and each artefact's URL, byte count,
  upstream `Last-Modified` and sha256 — so a later session can verify a claim in
  `docs/data/sources.md` instead of taking it on trust.
- **`docs/data/sources.md` §3 — BKG's required attribution corrected from the publisher's own file.**
  The CLC5 archive ships `quellenvermerk_datenlizenz_deutschland.txt`, which gives exactly two
  permitted forms and makes clear that **sela must always use the *(Daten verändert)* one** — a
  `criterion_value` derived from CLC5 polygons is by definition an alteration. The previously
  recorded string used the plain form. A discrepancy is flagged rather than papered over: the
  in-archive file omits the `dl-de/by-2-0` label that BKG's own catalogue record includes, so the
  safe rendering carries both the label and the change notice. Also verified from inside the
  archive: every layer's `.prj` is `ETRS_1989_UTM_Zone_32N`, so **no reprojection is needed for
  CLC5** — previously inferred from the filename, now read off the data.
- **Artefact pinning enforced by the pipeline, not just documented.** `sources.manifest.json` now
  carries a `fetch` block per confirmed source (URL, `pinnedBytes`, `pinnedLastModified`), and
  `01_fetch.sh` compares what the server offers against it **before writing anything**, exiting 4
  on drift. A publisher silently re-issuing a file under the same URL would otherwise change
  sela's inputs with nobody noticing.
- **`docs/data/sources.md` §4.1 — the non-ODbL alternatives research §4 left outstanding.** Option
  (b) was recorded in the previous entry with the caveat that no substitute dataset had been
  identified. Two now have been, both licence-verified in the publisher's own ISO 19139 metadata:
  **BKG CLC5 classes 111/112** (*Durchgängig* / *Nicht durchgängig städtische Prägung*) under
  `dl-de/by-2-0`, and **BKG DLM250 layer SIE01_F** (ATKIS `52001 AX_Ortslage`) under GeoNutzV — the
  regime sela already cleared for BfN. Neither matches OSM: CLC5 has a **5 ha minimum mapping
  unit**, so hamlets below it are absent and class 112 encloses gardens and roads inside the
  settlement edge; DLM250 is generalized for 1:250 000 and models a settlement **as a point** where
  it is a *Sammelgemeinde* without its own *Ortslage*. Option (b) therefore trades a licensing
  constraint for a documented accuracy cost rather than avoiding a cost.
- **Three candidates ruled out in §4.1, with reasons recorded so they are not re-researched.**
  **LBM-DE2021** — the 1 ha model CLC5 is generalized from, and the obvious finer substitute — is
  **not open**: its GDI-DE records carry *"Es gelten Zugriffsbeschränkungen"* and point at the AdV
  for acquiring usage rights, even though the `.gpkg.zip` sits on the same open-data host as CLC5.
  That is the trap this project's "no invented facts" rule exists for: reachable on the open-data
  server is not openly licensed. **DLM250's building layer** (`31001 AX_Gebaeude`) is a *selection*
  per BKG's own capture criteria — parliaments, supreme federal courts, planetaria, churches partly
  by height — not a building stock. **BKG Hausumringe (HU-DE)** appears under no category on the
  open-data host at all.
- **`docs/data/sources.md` §4.1 — an unexpected second finding: the basemap need not be OSM
  either.** BKG publishes **basemap.de Web Vektor** as vector tiles with styles, fonts and sprites,
  and its terms of use (read in full) place it under **CC BY 4.0**, with `dl-de/by-2-0` as an
  alternative — no share-alike. This materially changes what option (b) means: if both legs move
  off OSM, ODbL leaves sela's stack entirely and §4.6's machine-readable-access duty never attaches
  to anything. Recorded with its three unverified costs (ADR-0003 chose PMTiles built with
  Planetiler; the archive is pre-tiled in EPSG:3857; the layer schema is BKG's, so
  `ingest/basemap/` would be rewritten rather than reconfigured). **An ADR-0003 change is
  §3-gated** — this is a lead, not a decision.
- **Verified facts that unblock real ingestion work, none of which existed before** — recorded in
  `docs/data/sources.md` §2: the DWD grids are **EPSG:31467** (Gauß-Krüger zone 3, Bessel/Potsdam),
  so a reprojection step to the EPSG:25832 storage CRS is required and `ingest/02_reproject.sh` has
  a real job to do; DWD publishes a **±6 % mean uncertainty** for those grids, which is the first
  citable number this project has for the `criterion_value.confidence` column rather than an
  invented one; the BKG CLC5 download exists in a **UTM32S variant** that matches sela's storage CRS
  and needs no reprojection at all; and the three BfN layers sela actually needs (*Naturschutz-*,
  *Landschaftsschutzgebiete*, *Nationalparke*) were each checked individually in the GDI-DE
  catalogue rather than generalized from a sample.

- **`README.md`** — a Screenshots section with the five MVP screens, captured against the running
  app (synthetic fixture dataset).

### Changed

- **`design-language.md` §2a** — the one exception to the 3D ban, with its rules: literal and
  never encoded, true scale, stated dimensions, an architect's-model register, say what is
  missing, motion optional, never the entry point. §3 gains the map-surface panel treatment; §12
  gains a 3D checklist item.
- **The unit list selects instead of navigating.** It used to link straight to the detail page;
  it now selects the unit on the map, and the selection card carries the links. The keyboard e2e
  test was rewritten for the new path rather than deleted.
- **MapLibre's attribution links are underlined** on map surfaces. axe flagged them
  (`link-in-text-block`) once the explorer's panels changed the surrounding contrast; the
  attribution is a legal duty (ADR-0005), so it must be recognisable as links.
- `docs/product/mvp.md` §7 adds the preview to the screens; `.env.example` documents `SELA_TERRAIN`.

- **The machine gate is open for two of four sources.** `ingest/sources.manifest.json` now reads
  `confirmed` for `bkg-clc5` and `dwd-cdc-radiation`. This is a `CLAUDE.md` §3 decision (data
  sources and licensing) and was taken by the project owner on 2026-09-19, on the basis that both
  rows are licence-cleared, version-pinned and carry no share-alike term. `bfn-schutzgebiete` and
  `osm-geofabrik` were held at `to_confirm` deliberately — the first because no extract can be
  retrieved, the second because the ODbL question below is still open. `docs/data/sources.md` §1
  and the manifest were changed together, as they must be.
- **`ingest/run.sh` — a gated source is now skipped, not fatal.** The real pipeline used to abort
  at the first `01_fetch.sh` call, which was correct when every row was unconfirmed and useless the
  moment some were not. It now distinguishes `01_fetch.sh`'s exit codes (0 fetched, 1 blocked by
  the gate, 2 unknown id, 3 confirmed-but-unimplemented, 4 pin mismatch), continues past 1 and 3,
  aborts on 2 and 4, and prints a fetch summary. Reproject/load/sample for real sources are still
  deliberately absent rather than stubbed: fetching a dataset is not the same as knowing how to
  sample it onto the grid, and ADR-0004 exclusions must not be half-applied.
- **`docs/data/sources.md` §2.3 — DWD specifications re-verified against the delivered files, not
  only the description PDF**, and two upstream defects found. The grid header confirms V003,
  654 × 866, `CELLSIZE 1000`, `NODATA_VALUE -999`, kWh/m² and Gauß-Krüger 3rd meridian strip on
  Potsdam datum, identical in origin and extent across every year sampled — so a multi-year
  aggregate needs no resampling. But: (1) a **22-line DWD preamble precedes the Esri header**, so
  the file is not a bare Esri ASCII grid and needs a strip step before `02_reproject.sh`; and
  (2) **`Titel_2` is wrong in the four most recent files** — 2022–2025 say `Monatssumme` in a
  dataset of annual sums, while 1991–2021 say `Jahressumme`. The values (1 092–1 307 kWh/m² for
  2025) prove the label wrong, not the data. Nothing in the ingest path may read `Titel_2` to
  determine units or accumulation period; the mislabelling is silent and would produce a plausible
  wrong answer rather than an error.
- **`ingest/README.md`** — "Real ingestion is currently blocked" becomes "partially open", with a
  per-source status table, the exit-code contract `run.sh` depends on, and the reminder that being
  fetched is not being publishable (§7 condition 4 still binds for every row).
- **`docs/data/sources.md`** — rewritten. **U7's licence research is done: all four datasets' terms
  are now read at a primary source**, closing four of the five dead ends the `0.2.1` session logged
  (each of those URLs was retried, and the ones that had failed were either reachable again or
  reached at a corrected URL). BfN is **GeoNutzV** (full text read — §2 permits combining the data
  into *selbständige neue Datensätze* and transmitting them to third parties, §3 requires an
  attribution and change notice, and there is no share-alike), BKG CLC5-2018 is **`dl-de/by-2-0`**
  with the exact artefact pinned by size and `Last-Modified`, and DWD CDC is **CC BY 4.0** — a row
  `0.2.1` recorded as outright blocked with its terms unread. Each row now answers the question U7
  actually asks — may *derived, aggregated, scored* outputs be published — rather than "is the raw
  data open". New sections: the exact attribution string each publisher requires (§3), the ODbL
  decision below (§4), the BfN use limitation below (§5), a two-part verification log that
  distinguishes a publisher-side block from an environment-side one (§6), and a fourth "Confirmed"
  condition — the attribution must be implemented before the data reaches a public screen, not
  added later (§7).
- **`docs/data/sources.md` §4 — the substantive finding, recorded as an open `CLAUDE.md` §3
  decision rather than taken.** The `0.2.1` note that a derived criterion value counts as an ODbL
  "produced work" outside share-alike was an interpretation stated as a fact, and reading the ODbL
  legal code does not support it: a Produced Work is defined as *an image, audiovisual material,
  text or sounds*, while extracting a substantial part of the contents into a new database is a
  **Derivative Database**. A `criterion_value` table built from OSM settlement geometry is therefore
  most defensibly a Derivative Database, which puts §4.4 share-alike and §4.6 (offer a
  machine-readable copy of the derivative database or of the alterations) on **sela's own scoring
  database** — beside GeoNutzV, `dl-de/by-2-0` and CC BY 4.0 rows that carry no such term. §4.6
  follows the scenario cards too, since they are Produced Works *from* a Derivative Database. Three
  options are stated with their costs; the basemap path is unaffected either way.
- **`docs/architecture/roadmap-to-first-deployment.md`** — §2.2 gets a status note (the gate's
  verification work is done, and "verified open licence" turns out not to be a single bar because
  one source changes what may be done with everything stored beside it); §3.1's Phase-1 licence
  table is marked superseded rather than quietly edited, since two of its four entries are now known
  wrong; U7 in §6 moves from "still open" to **narrowed** — one decision and two access problems.

### Fixed

- **The explorer no longer throws a selection away.** The pilot boundary loads asynchronously and
  framed the Uckermark when it arrived; a unit selected before that moment was framed and then
  immediately un-framed. Found by the new map greyscale test, which first "passed" by measuring
  basemap texture where the hatched unit should have been — the test now measures a plain unit as
  a control and requires the sample to be a rendered unit, and was checked to fail with the map's
  pattern layer switched off.
- **`app/(map)/Map.tsx`** — the map explorer's GeoJSON fill layer never painted in any browser:
  MapLibre resolves its background worker script relative to `import.meta.url`, which doesn't
  survive Next.js's webpack bundling (it resolved to the page's own URL, so the worker loaded the
  page's HTML as JavaScript and died immediately, and the source's tiling never completed). Fixed
  by pointing `maplibregl.setWorkerUrl` at a static copy of the installed package's worker bundle,
  produced by the new `scripts/copy-maplibre-worker.mjs` (wired into `predev`/`prebuild` so the
  copy always matches the installed `maplibre-gl` version rather than a hand-committed file that
  can drift on upgrade).

### Notes

**Open after the 3D parcel preview (ADR-0006), stated rather than left for a reader to find:**

- **U10 — the terrain licence does not reach a public `1.0`.** basemap.de 3D Gelände is under the
  *basemap.de 3D-Beta Dienste* terms, **not** CC BY 4.0: use *"zu Testzwecken"* during the beta,
  through the service only, no storage, `© GeoBasis-DE/BKG <Jahr>` plus a change notice. Display-only
  use in a pre-release product fits; publishing on it does not. Recorded in `docs/data/sources.md`
  §2.6 and `docs/product/mvp.md` §9 with the licence-clean fallback (BKG DGM200, `dl-de/by-2-0`,
  coarser than one cell).
- **§ 1 BbgWEAAbG was verified second-hand.** `bravors.brandenburg.de` failed TLS verification from
  this environment (also with the proxy CA bundle); the wording came through a fetch tool's summary.
  The interface says so beside the quote, and `docs/data/sources.md` §6 asks for a re-check against
  the official text. § 249 Abs. 10 BauGB was read verbatim.
- **A shim for deck.gl 9.4 on MapLibre 6** (`exposeTransformForDeck` in the preview scene): deck.gl
  still reads `map.transform`, which MapLibre 6 no longer exposes. Isolated in one function; remove
  once deck.gl supports MapLibre 6.
- **No real unit can be previewed yet.** Only the synthetic fixture at null island has units, so
  every committed screenshot shows flat ground with no basemap. Terrain, basemap and rings were
  verified over real Brandenburg ground with a throwaway local unit that was deleted afterwards and
  appears in no screenshot — a fabricated unit at a real place is exactly what the fixture's
  null-island rule exists to prevent.
- Dark mode remains light-only on map surfaces, as before.

- **The machine gate was untouched when the evidence was gathered, and opened separately once the
  §3 decision was taken.** `ingest/sources.manifest.json` said `to_confirm`/`unconfirmed` for every
  row throughout the research; two rows were flipped on 2026-09-19 by the project owner's explicit
  decision, and the other two were not. The separation is the point: the session that verifies a
  licence does not get to act on it.
- **Two unreachable hosts, two different causes**, distinguished in the verification log so a later
  session does not conflate them: `geodienste.bfn.de` returns a BfN-branded HTTP 403 to this
  environment for every path including the GetCapabilities request that succeeded on 2026-08-22
  (publisher-side; retry from another network), while `download.geofabrik.de` and `mis.bfn.de` are
  refused at CONNECT by this environment's own egress policy (nothing to do with the publishers —
  `ingest/basemap/build.sh` fetched from Geofabrik successfully during the `0.3.0` session).
  Neither the BfN extract nor the OSM extract can be pinned from here, which is what keeps those two
  rows short of the full `Confirmed` bar.
- **`docs/data/sources.md` §5 feeds U6.** Every BfN record carries the use limitation *"Nicht für
  Planungszwecke geeignet"* — confirmed as a metadata field, not an incidental remark in a service
  description. It does not block sela's advisory use, but sela's audience includes municipal
  planning offices, and this is an input to the disclaimer-posture decision.
- **`docs/data/sources.md` §5.2 is a new open scoring question, raised by the data rather than by
  a plan.** A single annual radiation grid is a weather observation, not a site property — the
  series spans 909 kWh/m² (2000) to 1 319 kWh/m² (2020), so scoring a parcel from one year makes
  the verdict a function of which year was picked. Single recent year, rolling mean, or the
  1991–2020 climate normal are all defensible and give different numbers for the same land. That is
  a `CLAUDE.md` §3 scoring decision and is **not** taken; instead `01_fetch.sh` fetches the entire
  published series so the choice is not silently pre-empted by what happens to be on disk. Related:
  the ±6 % uncertainty DWD publishes is for a single grid, and `criterion_value.confidence` must
  not carry it for a multi-year mean until the combined figure is actually derived.
- **`CLC5-2021` exists and sela is pinned to 2018** (`clc5_2021.utm32s.gpkg.zip`, published
  2026-04-23, derived from LBM-DE2021, same `dl-de/by-2-0`). Moving to it would cut the
  data-currency gap by three years and is a **§3-gated source-version change** — recorded in §6,
  not taken. It is published as GeoPackage only; no shapefile variant exists for 2021.
- **What condition 4 still does not cover:** no `criterion_value` row derived from the fetched
  sources exists yet, so nothing has been rendered *from real data*. The attribution plumbing is
  verified; the pipeline that would use it is not built. Nor has migration `0003` been run against
  a live database — no Docker daemon in the environment that wrote it, so no PostGIS.
- **User-visible behaviour did change, on explicit instruction.** The map's default view and its
  basemap are both different: it opens on the Uckermark over a remote raster basemap rather than on
  synthetic cells over a flat ground colour. Two honest caveats. The raster tiles carry **baked-in
  labels** where the PMTiles style deliberately carries none until a self-hosted glyph pipeline
  exists, so this is a visible deviation from `design-language.md` §4.1 rather than a neutral swap.
  And ADR-0003's self-hosted archive is still what must exist before anything public ships — what
  landed is a reversible development default behind one environment variable, not an amendment.
- **Scoring and schema are untouched.** The code that changed is
  ingest-side only (`01_fetch.sh`, `run.sh`), and no fetched data reaches a screen: `data/raw/` is
  git-ignored, nothing was loaded into PostGIS, and `docs/data/sources.md` §7 condition 4 still
  blocks publication until each source's *Quellenvermerk* is rendered in the interface.

---

## [0.3.0] - 2026-08-23

Phase 3 of the roadmap: the deployable web app, fixture-first. Neither gate from `0.2.1` closed
before this phase started — `docs/data/sources.md` still has no `Confirmed` dataset, and every
weight in `docs/domain/scoring-criteria.md` is still explicitly `open`, pending the `CLAUDE.md` §3
confirmation gate. Rather than block Phase 3 on either gate, this release repeats `0.2.1`'s
architecture-first split, confirmed with the project owner beforehand: all five screens, the
basemap, and the export route are built and **demoed against the synthetic fixture dataset**
(`ingest/fixtures/`), with an obviously-arbitrary illustrative weighting — never against real
pilot data or real weights. Every screen and export carries a visible "ILLUSTRATIVE — not yet
confirmed" marker wherever a number derived from that weighting reaches the interface.

### Added

- **`lib/db/client.ts`, `lib/db/queries/{spatial-units,criteria,verdicts,outcomes}.ts`** — the
  app's first request-time database access layer (previously only `lib/db/migrate.ts`'s one-shot
  migration runner existed). Plain reads against the `0.2.1` schema, mapped to `lib/scoring/types.ts`'s
  shapes; `outcomes.ts` computes each scenario's delta against `status_quo` at read time via the
  existing pure `computeOutcomeDelta` — deltas are never stored.
- **`lib/scoring/illustrative-weights.ts`** — the demo-only, explicitly arbitrary weighting fed
  into `lib/scoring/`'s unmodified, existing `computeSuitability`/`computeOutcomeRow` as their
  normal caller-supplied parameters (never hardcoded into `lib/scoring/` itself). Deliberately
  produces at least one `not_modelled` outcome (`restore` × `local_benefit`) so that first-class
  schema state is genuinely exercised, not just theoretically supported. 8 new `node --test` cases.
- **`ingest/07_materialize_scores.ts`** — the missing bridge from `criterion_value` rows to
  `suitability_verdict`/`outcome` rows: `ingest/run.sh` stopped after writing criterion values;
  nothing previously called `lib/scoring/` at all. Runs from the app/Node side, not the GDAL
  `ingest` container, per ADR-0002's TypeScript/geometry boundary. `pnpm db:materialize`.
- **Fixture expansion** — `ingest/fixtures/seed_fixture_definitions.sql` and the new
  `ingest/05b_sample_illustrative_variation.sql` add `fixture_agripv_suitability` (agripv),
  `fixture_wind_resource` (wind), and `fixture_protection_status` (a hard constraint applying to
  all three technologies) alongside the existing PV-only criterion, so all three technologies vary
  independently and the ADR-0004 exclusion path is genuinely exercised. Derived deterministically
  from each cell's centroid position — never `random()` — so idempotency holds.
- **Five screens** (`docs/product/mvp.md` §7): map explorer (`/`, MapLibre + PMTiles, a
  keyboard-reachable unit list alongside the map per design-language.md §9), parcel detail
  (`/unit/[id]`, flow F2), scenario comparison (`/unit/[id]/compare`, the centrepiece — all
  scenarios × outcome dimensions + deltas, a decorative SVG chart plus an always-present semantic
  `<table>`), evidence view (`/criterion/[id]`, flow F4), and method page (`/method`, rewritten to
  render live `criterion_definition`/`source` rows instead of static placeholder text). Shared
  components (`ScenarioBadge`, `IllustrativeBanner`, `ConfidenceMark`, `NotModelledBadge`) read
  `lib/design/tokens.ts` so labeling and the design-language §4.2 palette can't drift between them.
- **Self-hosted PMTiles basemap** (ADR-0003, `docker/Dockerfile`'s new `basemap` build stage,
  `app/api/tiles/{[z]/[x]/[y],style.json}/route.ts`) — built via Planetiler against a small, real,
  licence-clear OSM extract (Bremen; OSM/ODbL is the dataset closest to `Confirmed` in
  `docs/data/sources.md`), **not** the fixture boundary itself: `ingest/fixtures/pilot_boundary.geojson`
  sits at "null island" deliberately, so serving fabricated-looking real streets under it would
  risk the exact credibility failure `CLAUDE.md` forbids. Serving the real extract globally instead
  means the tile-serving mechanism is proven against genuine data, and the fixture boundary
  correctly shows no basemap detail at all. No symbol/text layers in this pass, so no
  glyph/sprite pipeline is needed to satisfy ADR-0003's self-hosting rule. `ingest/basemap/build.sh`
  degrades to no archive (never a hard build failure) if Geofabrik or Java aren't reachable at
  build time; the app then serves a flat ground-colour style with no vector source.
- **`app/api/unit/[id]/card/route.tsx`** — `next/og` scenario card export (1200×630, 1080×1080,
  and a print variant), implementing design-language.md §7's "a card that cannot cite itself must
  not render" as actual control flow: every source the card needs is resolved before
  `ImageResponse` is constructed, and a missing lookup returns a 4xx/5xx JSON error, not an image.
- **`tests/e2e/`** (Playwright + `@axe-core/playwright` + `sharp`, new devDependencies) — automated
  WCAG 2.2 AA checks on all five screens, a keyboard-only path into unit selection and the compare
  screen's table, and a greyscale test that screenshots the comparison screen's pattern legend,
  converts it with `sharp`, and asserts each patterned scenario fill (all but the two intentionally
  flat ones) shows measurably higher local variance than a flat fill — the actual legibility
  property design-language.md §4.3's documented luminance-collision numbers exist to protect,
  checked directly rather than assumed present.
- **`lib/pilot-region.ts`** — the one place `DEFAULT_PILOT_REGION = "fixture-region"` is named,
  imported everywhere a screen or API route needs it.

### Fixed

- **`lib/db/migrate.ts`** — `import.meta.dirname` was left unset when `tsx` transpiles this script
  to CJS for `pnpm db:migrate`, breaking the migration runner outright; derived from
  `import.meta.url` instead, which works under both.

### Changed

- **`app/(map)/page.tsx`, `app/method/page.tsx`** — rewritten from Phase 1 static placeholders to
  the real screens above.
- **`docker/Dockerfile`** — new `basemap` build stage; `compose.yaml` gets a `materialize` service.
- **`package.json`** — `maplibre-gl`, `pmtiles` (deps); `@playwright/test`, `@axe-core/playwright`,
  `sharp` (devDeps); `db:materialize` and `test:e2e` scripts; version → `0.3.0`.

### Verification

- `pnpm typecheck`, `pnpm test` (27/27, including 8 new illustrative-weights cases), and
  `pnpm build` all pass.
- **Actually run end to end in this session's dev environment**, not left as a stated risk: a
  system PostgreSQL 16 + PostGIS instance was set up (the PostGIS extension package was missing
  and installed); `ingest/run.sh --fixture` and the new `05b` step ran for real (33 hex cells, 4
  criteria each, re-run 3× with identical row counts — idempotency holds); `pnpm db:materialize`
  populated 99 verdicts (30 excluded correctly by the protection-status constraint, the rest split
  suitable/unsuitable per technology) and 1,188 outcome rows (33 correctly `not_modelled` — exactly
  the `restore`×`local_benefit` cells) against real `lib/scoring/` calls; all five screens were
  fetched and rendered correctly against this real data (a date-serialization bug in the evidence
  view was caught and fixed this way, not left for a later session to find).
- **The basemap was actually built, not simulated**: Planetiler + a real ~20 MB Bremen extract from
  Geofabrik produced an ~11 MB `.pmtiles` archive in about two minutes; served locally, a tile over
  Bremen returned real vector data (200, ~41 KB) and a tile over the fixture boundary's null-island
  coordinates correctly returned no data (204) rather than anything fabricated.
- **The export route was actually exercised**: all three size variants render real PNGs for a unit
  with a verdict; a nonexistent unit id correctly returns 404 instead of an image.
- **The Playwright suite actually ran and passed (8/8)** against the live seeded database — zero
  axe violations on all five screens, the keyboard-only path works, and the greyscale variance
  check passes for every patterned scenario fill.
- **The production build was verified**, including running the built `standalone` server directly
  (`docker compose up` itself was still not run — no Docker daemon in this development
  environment, the same limitation `0.2.0`/`0.2.1` recorded).

### Notes

- Real pilot ingestion (`docs/data/sources.md` reaching `Confirmed`), real `criterion_definition`
  weights (`docs/domain/scoring-criteria.md`, gated by `CLAUDE.md` §3), and pinning the real pilot
  *Landkreis* (roadmap §2.3) remain open — this release is explicitly, visibly a demo of the
  mechanism, not a claim about any real place. `docs/architecture/roadmap-to-first-deployment.md`
  §6: none of U1–U9 close as a result of this phase.

---

## [0.2.1] - 2026-08-22

Phase 2 of the roadmap, architecture-first: the domain schema, ADR-0004, the scoring engine, and
the ingest pipeline's mechanics land. **Real dataset ingestion does not land in this release** —
`docs/data/sources.md`'s licence gate had not closed for any candidate dataset when this phase's
implementation started, and two of four licence-verification fetches attempted this session failed
outright. This split (architecture now, real ingestion once the gate closes) was confirmed with the
project owner before implementation, per `CLAUDE.md` §3 — see
`docs/architecture/roadmap-to-first-deployment.md` §4's status note.

### Added

- **`docs/architecture/adr-0004-constraints-as-filters.md`** — closes **U4**: a violated hard
  constraint (protection status, statutory setback) excludes a technology outright rather than
  lowering its score, naming the constraint. "A low score invites arguing the weight; an exclusion
  states the law."
- **`lib/db/migrations/0002_domain_schema.sql`** — the domain schema: `source`, `spatial_unit`,
  `criterion_definition`, `criterion_value`, `outcome`, `suitability_verdict`. `criterion_value.source_id`
  is `NOT NULL` and `outcome.status`/`suitability_verdict`'s CHECK constraints make "not yet
  modelled" and "excluded" first-class, unviolatable states rather than conventions. Verified by
  actually applying it to a local PostGIS instance and exercising every constraint (violations
  correctly rejected; valid rows correctly accepted).
- **`docs/domain/scoring-criteria.md`** — the criteria catalogue named in `docs/product/mvp.md` §4,
  per technology, with direction and candidate source stated. **Weights are deliberately left
  open** — assigning them is a scoring decision gated by `CLAUDE.md` §3, tracked as this
  document's own closing condition, not invented here.
- **`lib/scoring/`** — the suitability and outcome scoring engine (`docs/architecture/adr-0002-geodata-stack.md`:
  pure TypeScript, no I/O, no geometry). `computeSuitability` implements flow F2 (verdict + single
  limiting criterion) and the ADR-0004 filter path; `computeOutcomeRow`/`computeOutcomeDelta`
  implement the six shared outcome dimensions and deltas against the `status_quo` baseline, with
  `not_modelled` as a real state. Real weights, normalization, and the suitability threshold are
  caller-supplied parameters, not embedded constants — the module has no invented numbers. 19
  `node --test` unit/integration tests cover the limiting-criterion arithmetic, ADR-0004 exclusion,
  the `not_modelled`/delta-suppression path, and a fixture pipeline asserting every criterion
  feeding a verdict carries a source id.
- **`ingest/`** — the numbered pipeline (fetch → reproject → load → generate grid → sample → write)
  implemented for real: `01_fetch.sh` reads `ingest/sources.manifest.json` (a machine-readable
  mirror of `docs/data/sources.md`) and refuses to fetch anything not `confirmed`; `02_reproject.sh`
  wraps `ogr2ogr`/`gdalwarp`; `03_load.sh` wraps `ogr2ogr -f PostgreSQL`; `04_generate_grid.sql`
  runs `ST_HexagonGrid` clipped to the pilot boundary; `05_sample.sql`/`06_write_criterion_values.sql`
  sample and write sourced `criterion_value` rows. `run.sh --fixture` runs the identical pipeline
  against synthetic, clearly non-real data in `ingest/fixtures/` — this was actually executed
  against a local PostGIS instance (33 hex cells generated, sampled, and written with sourced
  criterion values; re-run twice more with zero duplication, confirming idempotency) and the real
  (unconfirmed-dataset) path was confirmed to correctly block at the fetch gate rather than
  silently proceeding.
- **`docker/Dockerfile.ingest`** — adds `jq` and `postgresql-client` (needed by the now-real
  `run.sh`), switches `CMD` to `ENTRYPOINT` so `docker compose --profile ingest run ingest --
  --fixture` can select the fixture path.
- **`package.json`** — `pnpm test` runs the `lib/scoring/` suite via `node --import tsx --test`.

### Changed

- **`docs/data/sources.md`** — adds a verification log recording exactly what was fetched and read
  this session (OpenStreetMap's ODbL terms confirmed via `openstreetmap.org/copyright`; BfN's WFS
  capabilities document corrected from an assumed `dl-de/by-2-0` to the GeoNutzV basis it actually
  cites; `govdata.de` and two DWD terms URLs failed to resolve). No row reaches Confirmed as a
  result — the log exists so a later session does not repeat a dead end or mistake an attempted
  fetch for a verified licence.
- **`docs/architecture/roadmap-to-first-deployment.md`** — §4 gets a status note explaining the
  architecture-first split; U4 marked closed against ADR-0004.
- **`lib/scoring/README.md`**, **`ingest/README.md`** — rewritten from Phase 1 placeholders to
  describe what is now actually implemented.

### Verification

- `pnpm typecheck` passes.
- `pnpm test` — 19/19 passing (`lib/scoring/__tests__/`).
- `lib/db/migrations/0001_init.sql` and `0002_domain_schema.sql` applied to a real local
  PostgreSQL 16 + PostGIS 3.4 instance; every CHECK/NOT NULL constraint was exercised directly
  (deliberate violating inserts correctly rejected, valid inserts correctly accepted).
- `ingest/run.sh --fixture` executed end-to-end against the same local instance: reprojection,
  PostGIS load, hex-grid generation, area-weighted sampling, and sourced `criterion_value` writes
  all ran for real and were inspected, not just written on faith. Re-run three times total with
  identical row counts each time (idempotency).
- `ingest/run.sh` (real mode) executed and confirmed to stop at the licence gate with a clear
  message, rather than proceeding.
- `docker compose up`/`docker compose --profile ingest run ingest` themselves were **not** run —
  this development environment has no Docker daemon available, same limitation noted in `0.2.0`.
  The Dockerfile.ingest changes mirror the locally-verified `jq`/`postgresql-client`/GDAL toolchain
  exactly, but the containerized path should be confirmed on a machine with Docker before being
  treated as proven end to end.

### Notes

- This closes **U4**. It does **not** close **U7** (per-source licensing) — that remains open and
  now has a written record of exactly which verification attempts failed and why, in
  `docs/data/sources.md`.
- Real ingestion, real `criterion_definition` weights, and therefore a real end-to-end scored
  parcel are the natural next work — gated on `docs/data/sources.md` reaching Confirmed per
  dataset, and on the `CLAUDE.md` §3 confirmation gate for the actual weight values.

---

## [0.2.0] - 2026-08-22

Phase 1 of the roadmap: the decisions of record are written as ADRs, and a Docker-deployable
application skeleton exists. No pilot-region data, scoring, or map rendering yet — that is
`0.2.1` and `0.3.0`.

### Added

- **`docs/architecture/adr-0001-spatial-unit.md`** — generated 100 m hex grid via PostGIS `ST_HexagonGrid`, behind a `spatial_unit.kind` abstraction so ALKIS *Flurstück* is a later addition, not a rewrite. States what is given up: a grid cell is not what a municipality names in a council session. Closes **U1**.
- **`docs/architecture/adr-0002-geodata-stack.md`** — Next.js (App Router, TypeScript) + PostGIS + MapLibre GL, with the binding rule that TypeScript never computes geometry or raster math; a separate `ingest` container owns GDAL and PostGIS SQL.
- **`docs/architecture/adr-0003-basemap.md`** — self-hosted PMTiles from OSM via Geofabrik, styled desaturated in-repo, fonts and sprites self-hosted rather than CDN-fetched. Records the standing ODbL attribution duty on every screen and export. Closes **U8**.
- **`docs/domain/glossary.md`** — DE/EN vocabulary for spatial units, scenarios, technologies, criteria, and provenance terms, each tied to the identifier it maps to in schema, code, or UI.
- **`docs/data/sources.md`** — the licence gate on Phase 2 ingestion. Four candidate datasets recorded with licence position; three carried forward as previously assessed, one (DWD CDC radiation grids) explicitly marked unconfirmed and blocking until its terms are read in full.
- **Application skeleton** — Next.js App Router project (`app/`, `lib/`) with a map-explorer route, a `/method` placeholder, and a `/api/health` liveness check; `lib/design/tokens.ts` and `app/globals.css` implementing the `design-language.md` §4.2 semantic palette (both light and dark, with each scenario's required secondary encoding) as tokens rather than raw hex; `lib/db/migrate.ts`, a minimal SQL migration runner, plus one migration enabling the `postgis` extension; `lib/scoring/` and `ingest/` left as documented placeholders for `0.2.1`.
- **Docker** — `docker/Dockerfile` (multi-stage, `next.config` `output: 'standalone'`), `docker/Dockerfile.ingest` (GDAL-based placeholder), `compose.yaml` wiring `app` · `db` (`postgis/postgis:16-3.4`) · a `migrate` step · `ingest` (profile-gated). `.env.example`, `.dockerignore`.

### Changed

- **`README.md`** — status moved to `0.2.0`; repository layout and a "Running it" section reflect what now exists.

### Verification

- `pnpm install`, `pnpm typecheck`, and `pnpm build` all pass; the built `standalone` server was run directly and `/`, `/method`, and `/api/health` were confirmed to respond.
- `docker compose up` itself was **not** run — this development environment has no Docker daemon available. The Dockerfile stages mirror the locally-verified build exactly (same `pnpm install` / `pnpm build` / standalone output), but the container path should be confirmed on a machine with Docker before this is treated as proven end to end.
- The migration script was verified by typecheck only; no local Postgres/PostGIS server was available to run it against.

### Notes

- This closes **U1** and **U8**. `docs/product/mvp.md` §10's `0.2.0` bar — spatial unit as an ADR, a data-source inventory with licence per dataset, and scenarios specified precisely enough to implement — is met for the spatial unit and the inventory; the criteria catalogue (`docs/domain/scoring-criteria.md`) is still open and is the natural next document.
- **U4** (constraints as filters vs. penalties) is deliberately not decided here — the roadmap places it in Phase 2 as ADR-0004, once real criterion data exists to reason about.

---

## [0.1.0] - 2026-08-21

Initial project setup. Establishes the mission, the working agreement, the MVP definition, and the visual standard. Planning artefacts only — no implementation, and no technology stack chosen.

### Added

- **`CLAUDE.md`** — working agreement for Claude Code: sela's mission, the mandatory planning-first workflow (restate → assumptions → unknowns → phased plan → affected files → risks → confirm), the confirmation gate covering architecture, scoring, scope, user-visible behaviour, data/licensing, and visual language, and the six product principles stated as checkable constraints.
- **`.claude/settings.json`** — project settings with `permissions.defaultMode` set to `plan`, so sessions start in plan mode by default.
- **`README.md`** — project vision, problem statement, the four target user groups and the question each arrives with, MVP scope and non-goals, core principles, design register, repository layout, next planning documents, versioning approach, and advisory-use disclaimer.
- **`CHANGELOG.md`** — this file; initialises versioning at `0.1.0` and defines the version ladder.
- **`docs/product/mvp.md`** — MVP definition: objective, target users, non-goals, the three technologies and the criteria driving each, the four scenarios and their output shapes, first user flows, first screens, core data and scoring concepts (criterion record, outcome dimensions, the no-hidden-composites rule), nine recorded open questions, and demonstrable success criteria for v0.1 / v0.2 / v0.3.
- **`docs/product/design-language.md`** — visual standard: the editorial-cartographic register, named anti-patterns, semantic colour system with colourblind and greyscale-print constraints, typography, map styling rules, the shareable scenario card format, the confidence and uncertainty vocabulary, and the WCAG 2.2 AA / BITV 2.0 accessibility floor.
- **`.gitignore`** — OS, editor, environment, Python, and Node exclusions, plus geodata artefacts (`*.gpkg`, `*.tif`, `*.parquet`, `data/raw/`, and similar), which are referenced by source and licence in documentation rather than committed.

### Notes

- Nine open questions are recorded rather than assumed. The most consequential are the choice of spatial unit (ALKIS *Flurstück* vs. a generated grid), whether grid-connection capacity is in MVP scope, and per-source data licensing — each is capable of reshaping the data model or blocking public release.
- No LICENSE, contribution guide, CI configuration, or dependency manifest yet; these follow once the stack is chosen in the `0.2.x` band.

[Unreleased]: https://github.com/richardkfm/sela/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/richardkfm/sela/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/richardkfm/sela/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/richardkfm/sela/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/richardkfm/sela/releases/tag/v0.1.0
