# Data source inventory

**Version band:** `0.2.x` · **Status:** gate on Phase 2 · **Last updated:** 2026-08-22

This is the gate `docs/architecture/roadmap-to-first-deployment.md` §2.2 and §3.1 requires before
any dataset enters ingestion: `CLAUDE.md` §5 forbids asserting a licence that has not been
verified, and no dataset below may be used in `0.2.1` ingestion until its **Licence position**
column reads **Confirmed**, not **To confirm**.

Nothing in this table states a coverage, resolution, or licence beyond what has actually been
read at the source cited in the last column. Where that has not happened yet, the row says so.

---

| Dataset | Publisher | Use in sela | Version / vintage | Resolution / coverage | Licence | Redistributable (derived outputs)? | Status | Source checked |
|---|---|---|---|---|---|---|---|---|
| BfN Schutzgebiete (WFS) | Bundesamt für Naturschutz | Protection areas → hard constraints / exclusions for `develop` suitability | Live WFS, vintage not yet pinned for a specific ingest run | Federal coverage, vector | `dl-de/by-2-0` | To confirm — `dl-de/by-2-0` is an attribution-only open licence, generally redistribution-friendly, but this has not been individually re-verified against BfN's current terms page for this service | Carried forward from `docs/architecture/roadmap-to-first-deployment.md` §3.1 | `geodienste.bfn.de/ogc/wfs/schutzgebiet` |
| BKG CORINE Land Cover 5 ha (CLC5) | Bundesamt für Kartographie und Geodäsie | Land cover, current use (`status_quo` baseline) | 2018 | 5 ha minimum mapping unit, federal coverage | `dl-de/by-2-0` | To confirm, same basis as above | Carried forward; **2018 vintage is a stated data-currency limitation**, not silently passed off as current | Not yet re-verified this session |
| OpenStreetMap via Geofabrik | OpenStreetMap contributors / Geofabrik (extract service) | Basemap (ADR-0003); settlement geometry for wind setback distances | Rolling — pinned to extract date at ingest time | Federal coverage, vector | ODbL 1.0 | Yes, with attribution — ODbL permits derived/produced works under share-alike for the *database*, attribution for produced works | Confirmed at the licence-family level; **not yet re-verified for this specific ingest use** (attribution placement duty tracked as a standing UI requirement, ADR-0003) | Not yet re-verified this session |
| DWD CDC radiation grids | Deutscher Wetterdienst, Climate Data Center | Solar irradiation input for PV/agri-PV suitability | 1 km, annual global radiation | Federal coverage, raster | **Unconfirmed** | **Unconfirmed — do not assume redistributable** | **Blocked.** Terms have not been read in full. Carried forward unresolved from `docs/architecture/roadmap-to-first-deployment.md` §3.1. Ingest must not start on this dataset until this row changes to Confirmed. | Not yet checked |

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
