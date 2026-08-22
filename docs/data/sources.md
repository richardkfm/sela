# Data source inventory

**Version band:** `0.2.x` · **Status:** gate on Phase 2 — still open, see §Verification log · **Last updated:** 2026-08-22

This is the gate `docs/architecture/roadmap-to-first-deployment.md` §2.2 and §3.1 requires before
any dataset enters ingestion: `CLAUDE.md` §5 forbids asserting a licence that has not been
verified, and no dataset below may be used in `0.2.1` ingestion until its **Licence position**
column reads **Confirmed**, not **To confirm**.

Nothing in this table states a coverage, resolution, or licence beyond what has actually been
read at the source cited in the last column. Where that has not happened yet, the row says so.

---

| Dataset | Publisher | Use in sela | Version / vintage | Resolution / coverage | Licence | Redistributable (derived outputs)? | Status | Source checked |
|---|---|---|---|---|---|---|---|---|
| BfN Schutzgebiete (WFS) | Bundesamt für Naturschutz | Protection areas → hard constraints / exclusions for `develop` suitability | Live WFS, vintage not yet pinned for a specific ingest run | Federal coverage, vector | **Under review — see log.** The WFS capabilities document does not itself declare `dl-de/by-2-0`; it points to the *Geodatenzugangsgesetz-Nutzungsverordnung* (GeoNutzV) instead. The `dl-de/by-2-0` label carried in earlier drafts of this row was an assumption, not a verified fact, and is corrected here rather than left standing. | To confirm — GeoNutzV's operative permission/attribution paragraphs (§2–§3) have not yet been read in full (see log); redistributability of *derived* outputs specifically is still unverified | **Blocked** — licence basis corrected this session, still not Confirmed | `geodienste.bfn.de/ogc/wfs/schutzgebiet` (2026-08-22); GeoNutzV text attempted via `gesetze-im-internet.de`, not yet read in full (see log) |
| BKG CORINE Land Cover 5 ha (CLC5) | Bundesamt für Kartographie und Geodäsie | Land cover, current use (`status_quo` baseline) | 2018 | 5 ha minimum mapping unit, federal coverage | `dl-de/by-2-0` | To confirm — the canonical `dl-de/by-2-0` text could not be fetched this session (see log); this row's licence label is carried forward, not freshly verified | Carried forward; **2018 vintage is a stated data-currency limitation**, not silently passed off as current | Not re-verified this session — `govdata.de/dl-de/by-2-0` returned HTTP 503 (see log) |
| OpenStreetMap via Geofabrik | OpenStreetMap contributors / Geofabrik (extract service) | Basemap (ADR-0003); settlement geometry for wind setback distances | Rolling — pinned to extract date at ingest time | Federal coverage, vector | ODbL 1.0 | Yes, with attribution, **for produced works** — `openstreetmap.org/copyright` (fetched 2026-08-22) confirms adapting and redistributing OSM data is permitted with attribution, and derived/aggregated results (like a criterion value) count as a "produced work" under ODbL's usual reading, not a database extract subject to share-alike | **To confirm requires one more thing:** the exact Geofabrik extract (region + date) used for the pilot has not been pinned yet — that is real ingestion work, not a licence question, and is what keeps this row below Confirmed | `openstreetmap.org/copyright` (fetched and read 2026-08-22 — see log) |
| DWD CDC radiation grids | Deutscher Wetterdienst, Climate Data Center | Solar irradiation input for PV/agri-PV suitability | 1 km, annual global radiation | Federal coverage, raster | **Unconfirmed** | **Unconfirmed — do not assume redistributable** | **Blocked.** Terms have not been read in full — two attempted URLs both 404'd this session (see log). Ingest must not start on this dataset until this row changes to Confirmed. | Attempted `dwd.de/DE/service/copyright/copyright_node.html` and `.../copyright_artikel.html`, both HTTP 404 (2026-08-22) |

## Verification log

Entries record what was actually fetched and read, so a later session does not repeat a dead end
or mistake an attempt for a confirmation. None of the attempts below were sufficient to move a row
to **Confirmed** — see the per-row notes above for what specifically is still missing.

**2026-08-22, Phase 2 architecture session:**

- `openstreetmap.org/copyright` — fetched successfully. Confirms ODbL permits copying, adapting,
  and redistributing OSM data with attribution, and that a derived/aggregated "produced work" is
  treated differently from redistributing the database itself. This is real evidence, not an
  assumption — but the pilot-region extract itself still needs to be pinned (source, date) before
  this row can read Confirmed.
- `govdata.de/dl-de/by-2-0` and `govdata.de/dl-de/by-2-0.txt` — both returned HTTP 503. The
  canonical `dl-de/by-2-0` text (relevant to both the BKG and, possibly, the BfN row) was not
  read this session. Retry in a later session rather than treating the licence family's public
  reputation as a substitute for reading it.
- `geodienste.bfn.de/ogc/wfs/schutzgebiet` — fetched successfully. The capabilities document cites
  the *Nutzungsbestimmungen für die Bereitstellung von Geodaten des Bundes* (GeoNutzV) as the
  applicable terms, **not** `dl-de/by-2-0` as an earlier draft of this table assumed — that
  assumption is corrected in the BfN row above. The same document states "Nicht für
  Planungszwecke geeignet" (not suitable for planning purposes), which is worth carrying into any
  future review of sela's own advisory-use disclaimer (`CLAUDE.md` §5) even though it does not by
  itself block sela's non-planning, advisory use.
- `gesetze-im-internet.de/geonutzv/index.html` — fetched, but only returned the ordinance's table
  of contents (§1–§5 headings), not the operative text of §2 (Nutzungen) or §3
  (Quellenvermerke) that the BfN row's Confirmed status actually depends on. The PDF/HTML full-text
  links on that page were not followed this session.
- `dwd.de/DE/service/copyright/copyright_node.html` and `.../copyright_artikel.html` — both HTTP
  404. The correct current URL for DWD's terms of use has not been located.

**What this means for Phase 2:** every dataset above remains below Confirmed. Per
`docs/architecture/roadmap-to-first-deployment.md` §2.2, real ingestion of any of them does not
start until its row reads Confirmed. `docs/architecture/roadmap-to-first-deployment.md` §4
(Phase 2) proceeds on its schema, scoring, and pipeline-mechanics deliverables in the meantime —
see that document's "Status" note — using synthetic fixtures (`ingest/fixtures/`) instead of real
data, exactly so that architecture work does not have to wait on, or quietly bypass, this gate.

## What "Confirmed" requires before Phase 2 ingest

For each row, before its dataset may be used in `docs/architecture/roadmap-to-first-deployment.md`
§4 ingestion:

1. The licence terms are read in full at the publisher's own current terms page (not inferred
   from a licence family name).
2. Whether *derived, aggregated, or scored* outputs may be published — not only the raw data —
   is explicitly confirmed. This is the distinction U7 (`docs/product/mvp.md` §9) exists to close,
   and it is not the same question as "is the raw data open."
3. The retrieval date and exact version/extract used for the pilot region are recorded here,
   replacing the "vintage not yet pinned" placeholders above.

## Candidates not yet in this table

`docs/product/mvp.md` §4 names additional criteria (soil quality / *Bodenzahl* / *Ackerzahl*,
species-sensitivity data for wind, statutory setback distances) whose specific source datasets
have not yet been identified. These are not silently assumed available — they remain open,
tracked against U2 and U4, and will be added as rows once a candidate source is found and its
licence checked, not before.
