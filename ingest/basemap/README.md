# `ingest/basemap/`

Builds the self-hosted PMTiles basemap archive (ADR-0003, roadmap §5.2) via
[Planetiler](https://github.com/onthegomap/planetiler)'s OpenMapTiles profile.

## Why a real extract, not the fixture boundary

`ingest/fixtures/pilot_boundary.geojson` sits at "null island" (0,0) — deliberately, so it can
never be mistaken for a real place. There is no real OSM data to show *there*, and fabricating a
real-looking street map under the fixture hex grid's illustrative scores would risk exactly the
"no invented facts" / credibility failure `CLAUDE.md` forbids: a user could mistake a real-looking
basemap under demo data for a real place's real suitability.

Instead, `build.sh` fetches a small, real, licence-clear OSM extract — the smallest German
*Bundesland* Geofabrik offers (Bremen, ~20 MB), chosen purely for build tractability and
**explicitly not** the eventual real pilot *Landkreis*, which stays unpinned (roadmap §2.3) — and
serves it globally. At the fixture boundary's coordinates the real tiles correctly render open
water/nothing; nothing is misrepresented, and the tile-serving mechanism — ADR-0003's actual point
— is proven against genuine OSM data. OSM/Geofabrik is the dataset closest to `Confirmed` in
`docs/data/sources.md` (ODbL, confirmed via `openstreetmap.org/copyright`), so this is not blocked
by the licence gate.

## Building

```sh
sh ingest/basemap/build.sh
# writes data/basemap/pilot.pmtiles (git-ignored, *.pmtiles)
```

Verified in this repository's own dev environment: a real ~20 MB Bremen extract fetched from
Geofabrik, built via Planetiler (`--download` fetches its small auxiliary source files —
lake centerlines, water polygons, natural-earth boundaries), produced an ~11 MB PMTiles archive in
about two minutes. Serving it locally, a tile over Bremen returns real vector data; a tile over the
fixture boundary's null-island coordinates correctly returns no data (204) rather than anything
fabricated.

On any failure — no network reaching Geofabrik, no Java, a Planetiler error — `build.sh` logs a
clear warning and exits `0` **without** producing an archive. `docker/Dockerfile`'s `basemap` stage
always has a directory to copy from either way, so a Docker build never hard-fails for lack of
network at build time. `app/api/tiles/style.json/route.ts` detects the missing archive
(`lib/basemap/pmtiles-reader.ts`) and serves a flat ground-colour style with no vector source
instead — a known, logged degraded state, not a broken one.

## No self-hosted glyphs/sprites in `0.3.0`

The generated style (`app/api/tiles/style.json/route.ts`) has no symbol/text layers, so it needs no
font glyphs or sprite sheet at all — nothing external to fetch, which trivially satisfies ADR-0003's
"self-hosted, never CDN-fetched" rule for this phase. Labels are a later addition, once a
self-hosted glyph pipeline is built for them specifically.

## Standing attribution

Per ADR-0003: "Maps made with these vector tiles must display a visible credit: © OpenMapTiles
© OpenStreetMap contributors." `style.json` carries this as the vector source's `attribution` field
whenever an archive is present; `app/api/unit/[id]/card/route.tsx`'s exports carry the same credit
in their provenance footer.
