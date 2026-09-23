# ADR-0006 — A 3D parcel preview: deck.gl over MapLibre, literal 3D only, geometry from PostGIS

**Status:** Accepted · **Band:** `0.3.x` · **Date:** 2026-09-23 · **Amends:** `docs/product/design-language.md` §2 (see its new §2a)

---

## Context

The project owner asked for "a proper map view" that looks good and innovative, and pointed to
geospatial apps that place 3D models on top of the map. `design-language.md` §2 lists *"no 3D or
metallic marks"* and *"no 3D bars"* among its anti-patterns, so any 3D is a visual-language change
and passes the `CLAUDE.md` §3 gate. The owner confirmed these choices on 2026-09-23, in two rounds
of questions:

| Question | Decision |
|---|---|
| Where does 3D live? | **The explorer stays a flat, polished 2D map.** Selecting a unit opens a *separate* tilted 3D preview. |
| What does the 3D show? | **Scenario preview models** (turbine, PV rows, Agri-PV rows) and **setback / visibility rings**. |
| Rendering stack | **deck.gl over MapLibre**, interleaved into MapLibre's WebGL context. |
| Data | **Research and add open data — DEM only**, not LoD2 buildings. |

The owner also chose *"keep map 2D, polish it"* and rejected extruding units by score. That
rejection is the most important constraint here: **no number sela computes is ever drawn as height.**

## Decision

### 1. Literal 3D only, in one place

3D is permitted for things that **physically exist at that height** — terrain, a wind turbine, a
module table — drawn at true scale (terrain exaggeration 1, no vertical stretch). Scores, verdicts
and outcomes stay flat and patterned, exactly as in 2D. The only 3D surface is the preview route
`/unit/[id]/preview`; the explorer is a plan view with pitch locked to 0.
`design-language.md` §2a records this as the one exception to §2's 3D anti-pattern.

### 2. deck.gl over MapLibre, interleaved

`@deck.gl/mapbox`'s `MapboxOverlay({ interleaved: true })` draws into MapLibre's own WebGL
context. MapLibre keeps the ground: basemap, terrain, the unit and its neighbours, the setback
rings — all draped on the relief. deck.gl draws the models, depth-tested against the terrain.

Rejected: a hand-written three.js custom layer (more code for picking, lighting and camera sync,
for the same result), and CesiumJS (would replace MapLibre and ADR-0002's rendering choice
wholesale for one screen).

**Known compatibility gap, worked around in the open.** deck.gl 9.4's MapLibre adapter reads
`map.transform.{elevation,height,_nearZ,_farZ}`; MapLibre 6 no longer exposes `map.transform`.
`exposeTransformForDeck()` in `app/unit/[id]/preview/Scene.tsx` answers exactly those reads from
MapLibre's public API (`getCenterElevation()`, the canvas height) and steps aside if `transform`
exists. Remove it once deck.gl supports MapLibre 6 natively.

### 3. ADR-0002's boundary holds for display geometry too

Every position the preview draws — row centre lines clipped to the unit and inset from its
boundary, support positions along each row, row bearings, geodesic rings, their label points, the
eye-level viewpoints on them — is computed in PostGIS (`lib/db/queries/preview.ts`) and served by
`/api/unit/[id]/preview`. Rows are laid out in the unit's stored EPSG:25832; rings use `geography`,
so a 1 000 m ring is 1 000 m on the ground.

TypeScript does two things, neither of them geospatial computation:

- **Builds meshes in model space** (`lib/preview/meshes.ts`) — vertices in metres in a local
  east/north/up frame, from the dimensions in `lib/preview/reference-geometry.ts`.
- **Reads the ground height back** from MapLibre's terrain (`queryTerrainElevation`) to seat each
  model. That is a lookup into the displayed DEM, used for placement only; nothing is sampled into
  `criterion_value` and nothing is stored.

### 4. Two kinds of number, never mixed

`lib/preview/reference-geometry.ts` separates:

- **Illustrative reference dimensions** — hub height 160 m, rotor diameter 160 m, row pitch,
  table depth, tilt, clearance. Plausible, deliberately not a manufacturer's model, each marked
  `basis: "illustrative"` and labelled *illustrativ* in the interface. The turbine's hub height and
  rotor diameter are sliders, because a reader who knows the planned turbine should be able to
  enter it.
- **Cited distances** — the rings, each with its legal source, quoted wording, measuring point and
  limits, verified at the primary source on 2026-09-23:
  - **2 H, § 249 Abs. 10 BauGB** — the rule of thumb for *optisch bedrängende Wirkung*, where
    H = hub height + rotor radius (S. 2). Drawn dashed: it is a *Regelvermutung*, not a minimum
    distance.
  - **1 000 m, § 1 BbgWEAAbG** — Brandenburg's minimum distance to *Wohngebäude*, which does not
    apply in designated *Windenergiegebiete*.

  Rings are drawn only for regions whose jurisdiction is recorded (`lib/pilot-region.ts`). The
  synthetic fixture region is drawn *as if* it lay in the Uckermark, and the interface says so.

### 5. What the preview must say about itself

- The rotor faces the viewer — the largest it can look — because wind direction is not modelled.
- Eye-level views show terrain and the turbine only. Buildings, woodland and hedgerows are missing
  and often block the view in reality: *"Das ist keine Sichtbarkeitsanalyse."*
- Rotor motion is illustrative, off under `prefers-reduced-motion`, and can be switched off.
- The one accent action is still *Szenarien vergleichen*. A picture of a turbine is not a
  comparison (`CLAUDE.md` §4.2).

## Terrain source

**basemap.de 3D Gelände** (BKG, DGM5), terrain-RGB tiles, Mapbox encoding, 512 px, z ≤ 15 — all
checked against the live service, not just its documentation (the product page says 256 px; the
tiles are 512). Recorded in `docs/data/sources.md` §2.6.

**Its licence is not basemap.de's CC BY 4.0.** The *basemap.de 3D-Beta Dienste* terms grant use
*"zu Testzwecken"* during the beta, runtime use through the service only, no storage, and require
`© GeoBasis-DE/BKG <Jahr>` with a change notice. The preview's use is display-only and within
those terms while sela is itself pre-release — but **it is not a licence for a public `1.0`
launch**. This is recorded as open question **U10** in `docs/product/mvp.md` §9. `SELA_TERRAIN=none`
turns the terrain off; the preview then draws on flat ground and says so.

The licence-clean fallback is **BKG DGM200** (`dl-de/by-2-0`, verified 2026-09-23). A 200 m grid is
coarser than one hex cell, so it would flatten the relief a parcel-scale preview exists to show; it
is recorded as a fallback, not wired in.

## Consequences

**Gained.** A reader can see how big an installation would be *on this land*: a 240 m turbine next
to a unit 200 m across, the 2 H and 1 000 m rings on the ground around it — over real villages and
roads once real units exist — and the turbine from eye height on either ring. Agri-PV's raised
tables read differently from ground-mounted PV, where the two share a colour on the map.

**Given up, and not hidden.**

- **A second third-party runtime dependency** (the terrain service) on one screen, on beta terms.
- **The preview is heavier** than the rest of the app: deck.gl and luma.gl, loaded only on the
  preview route (`next/dynamic`, `ssr: false`). Checked in the production build: deck.gl's chunks
  are in no route's initial manifest, and the explorer's page chunk does not contain them.
- **The eye-level view is persuasive and incomplete.** It is the most photographable thing sela
  now produces, and it omits exactly what most often hides a turbine. The caveat is on screen
  next to the button, not in a footnote.
- **A shim against a private API** (`_transformProvider.transform.nearZ`) that can break on a
  MapLibre minor update. It is isolated in one function and falls back to deck.gl's defaults.

**Not decided here.** Real-region previews wait on real ingestion. Nothing under Uckermark carries
a `pilot_region` yet, so no real unit can be previewed until the ingest pipeline assigns one — and
`lib/pilot-region.ts` gets that region's jurisdiction entry in the same change.
