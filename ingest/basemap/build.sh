#!/bin/sh
set -u
# Builds the self-hosted PMTiles basemap archive (ADR-0003) via Planetiler
# against a small, real, licence-clear OSM extract — chosen only for build
# tractability, NOT the eventual real pilot Landkreis (still unpinned, see
# roadmap §2.3). ingest/fixtures/pilot_boundary.geojson sits at "null
# island" specifically so it can never be mistaken for a real place;
# fabricating a real-looking street map under it would risk exactly the
# "no invented facts" failure CLAUDE.md forbids. Serving a real extract
# globally instead means: at null island the tiles correctly render open
# ocean (nothing misrepresented), and the tile-serving mechanism — ADR-0003's
# actual point — is still proven against genuine OSM data.
#
# OSM/Geofabrik is the dataset closest to Confirmed in docs/data/sources.md
# (ODbL, confirmed via openstreetmap.org/copyright) — this is not blocked
# by the licence gate. What IS unverified is network reachability from
# whatever environment eventually runs this build.
#
# On any failure (no network, no Java, Planetiler error), this script logs
# a clear warning and exits 0 WITHOUT producing an archive — a Docker build
# must never hard-fail for lack of network. The serving route
# (app/api/tiles/style.json/route.ts) degrades to a flat ground-colour
# style with no vector source when no archive is present, rather than the
# build silently substituting fabricated geometry.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTRACT_URL="${EXTRACT_URL:-https://download.geofabrik.de/europe/germany/bremen-latest.osm.pbf}"
PLANETILER_URL="${PLANETILER_URL:-https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar}"
OUTPUT_PATH="${OUTPUT_PATH:-$SCRIPT_DIR/../../data/basemap/pilot.pmtiles}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "basemap build: $1 — skipping; app will serve a flat ground-colour style with no basemap source." >&2
  exit 0
}

command -v java >/dev/null 2>&1 || fail "java not available"
command -v curl >/dev/null 2>&1 || fail "curl not available"

echo "basemap build: fetching OSM extract from $EXTRACT_URL"
curl -sS -L --fail --max-time 120 -o "$WORKDIR/extract.osm.pbf" "$EXTRACT_URL" || fail "could not fetch OSM extract"

echo "basemap build: fetching Planetiler from $PLANETILER_URL"
curl -sS -L --fail --max-time 120 -o "$WORKDIR/planetiler.jar" "$PLANETILER_URL" || fail "could not fetch Planetiler"

mkdir -p "$(dirname "$OUTPUT_PATH")"
echo "basemap build: running Planetiler (this fetches a few small auxiliary source files too)"
(
  cd "$WORKDIR" && java -jar planetiler.jar --download --osm-path=extract.osm.pbf \
    --output="$OUTPUT_PATH" --force
) || fail "Planetiler build failed"

echo "basemap build: wrote $OUTPUT_PATH"

cat <<'EOF' >&2
basemap build: NOTE — maps made with these tiles must display:
  © OpenMapTiles © OpenStreetMap contributors
This attribution is rendered in-app (see app/api/tiles/style.json/route.ts
and every next/og export) as a standing ADR-0003 obligation, not optional.
EOF
