# Roadmap — a planning tool for two Länder: Brandenburg and Sachsen, with the sector view kept

**Version band:** `0.3.x` · **Status:** milestone set by the project owner on 2026-10-10
("turn sela into a well designed and well usable planning tool for professional project planners
and interested individuals too; add Saxony and Brandenburg as a whole; keep the small sector
view"); planned and implemented on 2026-10-10 under that instruction, **pending the owner's
confirmation in review** of every decision this document marks *gated* · **Last updated:** 2026-10-10

This document is the `CLAUDE.md` §2 plan for that instruction: the task restated, the
assumptions, the unknowns, the phases, the files and the risks. It follows
`docs/product/roadmap-pilot-demo.md` (Steps 1–6, done) and refines `docs/product/mvp.md`; where it
widens the MVP's geography it says so and records the decision.

---

## 1. The task, restated

Three things were asked, and they pull in different directions:

1. **Coverage.** sela should cover the whole Land Brandenburg and the whole Freistaat Sachsen —
   not one Landkreis. That is roughly ten times the Uckermark's area in Brandenburg alone
   (29 697 km² and 18 478 km² against 3 082 km², measured from VG25 on 2026-10-10), so about
   1.1 million and 0.7 million 100 m cells against 117 191.
2. **The sector view stays.** The detailed view of a Landkreis — the Uckermark as it is today,
   every cell visible, selectable and grouped into sites — must survive. A Land-wide map that
   can only be looked at from far away is not a planning tool.
3. **Two audiences, one tool.** Professional project planners (developers, municipal planning
   offices) and interested individuals (a citizen, a council member, a journalist) must both be
   able to use it well. `mvp.md` §2 names both; what changes is that the tool has to be *usable*
   by them, not only *legible* to them: finding land, keeping a view, sharing it, taking the
   result into other tools.

**Where the restatement differs from the words.** "Well designed and well usable" is not a
feature list; this plan turns it into checkable changes (§4, Phase 3) and leaves what cannot be
checked — taste — to the design language. "Add Saxony" implies Saxony's own environmental data,
which sela does not have; what can be shipped for Saxony today is stated in §2 (A4) and §3 (U3),
not assumed.

## 2. Assumptions

| # | Assumption | Why it is one |
|---|---|---|
| A1 | The federal sources already confirmed — CLC5, DWD radiation, VG25, DGM200 (`docs/data/sources.md` §2.2–2.7) — cover both Länder at the same resolution and licence as the Uckermark. | Their rows say "Federal"; the archives are national. Not re-verified per Land beyond that. |
| A2 | The Brandenburg Land services already confirmed (LfU Schutzgebiete, LBGR Moorbodenkarte, LfU Wasserhaushalt, LfU Biotopkataster) cover the whole Land. | The WFS fetches were cut to the Uckermark's bbox; the files are statewide (§2.10, §2.12). The bbox is widened to the Land; nothing else changes. |
| A3 | A Landkreis view over a Land's grid may use the same 100 m cells the Land uses, so the Uckermark seen as a sector of Brandenburg is the same classification as the Uckermark seen on its own. | ST_HexagonGrid is anchored at the origin of the CRS, so cells coincide; the only difference is at the boundary (§6, R3). |
| A4 | For Sachsen, what can be shipped now is: the PV classification (protection exclusion, land-cover tier, irradiation quartile, slope), the Prüfhinweise, the energy outcome, and search by *Gemeinde*. Climate (peat), water and habitat stay *noch nicht eingelesen* in Sachsen until a Saxon or national source passes the licence gate (§3 U3). | Those three methods read Brandenburg-only sources. The methods already return *noch nicht modelliert* when their inputs are absent (`lib/scoring/nature/`), so nothing has to be faked. |
| A5 | The decided PV rules (`real-pv-v1`, ADR-0009) transfer to Sachsen unchanged: NSG and Nationalpark exclude; FFH, SPA, LSG and a Naturschutzgebiet below half a cell are Prüfhinweise. | The rule cites BNatSchG categories, not Brandenburg's. The Saxon data uses the same categories (`KATEGORIE` nach BNatSchG). Saxony's Flächennaturdenkmäler and Naturparke are loaded but neither exclude nor flag, like Brandenburg's Biosphärenreservat (memo Q1). |
| A6 | The owner's instruction is the delegation under which the gated decisions below are taken, as on 2026-09-28; each is recorded as pending confirmation, and each chooses the conservative option. | `CLAUDE.md` §3 asks for confirmation; the session cannot get it mid-task. The precedent is the roadmap Steps 3–6. |

## 3. Unknowns

**Blocking — none.** Nothing below makes the work useless if it goes the other way; each has a
stated fallback.

**Non-blocking, proceeded past under a stated assumption:**

| # | Question | Assumption taken | Recorded in |
|---|---|---|---|
| U1 | Saxony's protected-area downloads carry a note ("öffentlich zugänglich", citation on publication) but no licence name; the catalogue record of the same data names `dl-de/by-2-0`. Does the record govern the downloads? | Yes — the record's linkage is the download page, and the publisher and data date match. | `sources.md` §2.13 |
| U2 | How far out may an overview go before an aggregated class misleads? | The overview shows the *most frequent* class of a 1 km or 5 km hexagon with its share on hover and says so in the legend; it never shows a single cell as if it were visible. | `design-language.md` §4.2b, ADR-0012 |
| U3 | Which Saxon or national sources could give peat, water and habitat for Sachsen? | None adopted. Candidates are recorded with what was read (Thünen Kulisse organischer Böden, CC BY 4.0; LfULG Biotopkartierung SBK2/SBK3 and bt_lrt). Sachsen shows *noch nicht eingelesen* for those outcomes. | `sources.md` §2.14 |
| U4 | Is a 100 m cell the right unit for a Land-wide *overview*, as opposed to the sector view? | For the sector view, yes (ADR-0001). For the overview, the aggregated hexagons are a display pyramid over the same cells, not a new unit — no number is computed on them. | ADR-0012 |
| U5 | What do professional planners need beyond what is here? | Taken from `mvp.md` §2: find land, keep and share a view, export with sources, filter to what is buildable. Nothing was asked of a planner; the owner deferred user validation on 2026-09-27 and this plan does not claim it. | §4 Phase 3 |

## 4. Phases

Each phase names the `CLAUDE.md` §3 areas it touches; *gated* decisions are recorded as pending
confirmation in review (A6).

### Phase 1 — Regions as a hierarchy · gated (architecture, scope) — ADR-0012

- A `region` table replaces the TypeScript registry of pilot regions: Land, Landkreis and the
  fixture, each with its AGS, parent, name, jurisdictions and boundary (from VG25, CC BY 4.0).
- Each cell is stamped with the 8-digit AGS of the *Gemeinde* containing a point on its surface
  at ingest (`spatial_unit.ags`), so Land (2 digits), Landkreis (5) and Gemeinde (8) membership is
  one prefix test, and a Landkreis view over a Land's grid is a filter, not a second grid.
- Region-scoped reads take a `RegionScope` — which grid, and optionally which Landkreis prefix —
  resolved once per request from the region table and the unit counts.
- The ingest runs for a Land or a Landkreis by id (`REGION=brandenburg-12`, `sachsen-14`,
  `uckermark-12073`); boundaries for both Länder and all 31 Kreise are committed from VG25.
- Existing installs keep working: migration 0010 stamps the Uckermark cells from the
  municipalities already loaded, and `uckermark-12073` becomes a Landkreis region whose parent is
  Brandenburg.

### Phase 2 — An overview pyramid for the map · gated (user-visible behaviour, visual language) — ADR-0012

- Below the cell zoom the tiles carry aggregated hexagons — 1 km (zoom 8–10) and 5 km (zoom ≤ 7)
  — each with its cell count, the count per class per technology, and the most frequent class.
  Materialised with the verdicts, in SQL, from the cells themselves.
- Cells are drawn from zoom 11 (they were drawn from zoom 9, where one is under a pixel); the
  interactive zoom (ids, selection) stays 12. Nothing on the sector view changes from zoom 11.
- The legend says what the overview is; hovering an overview hexagon shows its shares; counts per
  class in the legend come from a materialised per-region table, so a Land does not count a
  million rows on every page load.

### Phase 3 — Usable for planners and for individuals · gated (user-visible behaviour)

- **Where am I:** a region switch with Land › Landkreis, and search by *Gemeinde* across the whole
  region shown (a Land has a few hundred).
- **Keep and share a view:** region, technology, map position, selected cell and grouped cells live
  in the URL, so a view can be bookmarked, pasted into an e-mail, or put in a council paper.
- **Only what I am looking for:** show only *ohne Einschränkung*, only cells without
  Prüfhinweise — a filter on the map's paint, with the legend counts unchanged (the filter hides
  classes, it never recounts them).
- **Take it with me:** a site exports as GeoJSON or CSV with every cell's classes, measured values
  and the sources' notices; an export that cannot cite itself does not render (design-language §7).
- **First steps for an individual:** a short "So lesen Sie die Karte" in the panel, with the way to
  find one's *Gemeinde* and to the method; the wording keeps the four questions of `CLAUDE.md` §1.
- **Pages share one shell:** a header with the wordmark, where you are (Land › Landkreis ›
  Gemeinde) and the way back to the map, and one typographic scale, on every page below the map.

### Phase 4 — Sachsen's data gate · gated (data sources and licensing)

- `lfulg-sn-schutzgebiete`: LfULG Sachsen protected areas (NSG, Nationalpark, LSG, FFH, SPA,
  Biosphärenreservat, Naturparke), read at source on 2026-10-10 (§2.13). Confirmed under A6.
- Research rows, not confirmed: Thünen *Kulisse organischer Böden* (peat, national), LfULG
  Biotopkartierung (habitat). Water: no Saxon equivalent of ArcEGMO found.

### Phase 5 — Operations and documentation

- `scripts/install.sh --data brandenburg|sachsen` beside `uckermark`; `SELA_REGION`.
- CHANGELOG, README, `CLAUDE.md` status line, `mvp.md` geography amendment, glossary.

## 5. Files

| File | Why |
|---|---|
| `docs/architecture/adr-0012-regions-and-overview.md` | The architecture decision: region hierarchy, AGS stamping, overview pyramid, region statistics |
| `lib/db/migrations/0010_regions_and_overview.sql` | `region`, `spatial_unit.ags`, `unit_overview`, `region_verdict_count`; backfill for existing installs |
| `lib/regions.ts` (replaces `lib/pilot-region.ts`) | Known Länder, their jurisdictions and sources; region ids |
| `lib/db/queries/regions.ts`, `municipalities.ts`, `spatial-units.ts`, … | Every region-scoped read takes a `RegionScope` |
| `lib/map/tiles.ts`, `app/api/units/tiles/…` | The pyramid's zoom bands and the overview tile SQL |
| `ingest/08_materialize_overview.sql`, `ingest/07_materialize_scores.ts` | Overview hexagons and per-region counts after the verdicts |
| `ingest/run.sh`, `ingest/real/*.sh`, `ingest/regions/` | Region by id; Land-specific sources; committed boundaries |
| `ingest/sources.manifest.json`, `ingest/seed_real_sources.sql`, `docs/data/sources.md` | The Saxon source and the research rows |
| `app/(map)/*`, `app/globals.css`, `components/PageShell.tsx` | Explorer navigation, URL state, filters, intro; the page shell |
| `app/api/site/export/route.ts` | GeoJSON and CSV export of a site |
| `scripts/install.sh`, `compose.yaml`, `.env.example`, `README.md`, `CHANGELOG.md`, `CLAUDE.md` | Operations and the record |

## 6. Risks

- **R1 Credibility at the overview.** A 5 km hexagon coloured amber reads as "this area is
  buildable". The legend and the hover say it is the most frequent class and the share; the
  pattern and colour are the same as the cells' so nothing new has to be learned. Still the most
  likely misreading on a projector — recorded in `design-language.md` §4.2b for the owner's review.
- **R2 Saxony half-equipped.** Sachsen gets suitability and energy but no climate, water or
  habitat outcomes. Every screen says *noch nicht eingelesen* where that is so; the comparison
  still shows all four scenarios. A reader may still take the thinner comparison as a statement
  about Saxon land rather than about sela's data — the notes are worded against that.
- **R3 Boundary cells differ between a Land grid and a Landkreis grid.** A cell straddling the
  Uckermark's border is dropped by the Uckermark grid (`ST_CoveredBy` against the Kreis) but kept
  by the Brandenburg grid (covered by the Land, stamped with a Gemeinde inside the Kreis). The
  Landkreis view of a Land grid therefore has a few hundred more edge cells than a Landkreis grid.
  Stated in ADR-0012; no number depends on it.
- **R4 Scale.** A Land ingest is ten times the Uckermark's: the CLC5 intersection and the grid
  generation are the slow steps. Verified here on Sachsen (§7); Brandenburg's run time is
  estimated from that, not measured.
- **R5 Legal.** The exclusion rule now also cites Saxon ordinances (SächsNatSchG) it has not read.
  The rule stays advisory in wording and names the category, never a permission outcome; the
  Saxon data's own caveat — boundaries do not necessarily follow parcel boundaries — is carried.
- **R6 Existing installs.** Migration 0010 changes the schema under running installs. It is
  additive, backfills the Uckermark's AGS from `municipality`, and the materialiser rebuilds the
  overview; an install that only migrates without re-materialising shows no overview below zoom 11
  until it does, and the explorer says so.

## 7. What was verified here, and what was not

Recorded as the work completed; see `CHANGELOG.md` for the final state.

- Unit tests and the fixture pipeline run against a local PostGIS (this environment has no
  Docker daemon; PostgreSQL 16, PostGIS 3.4 and GDAL 3.8 were installed natively).
- The Saxon protected-area archives were fetched and read (§2.13).
- VG25 was fetched; the Land and Kreis boundaries were cut from it with the committed script.
