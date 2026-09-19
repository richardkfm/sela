#!/bin/sh
set -eu
# Step 2c (roadmap §4.2): produce the **display-only** copy of the pilot
# boundary that the map explorer fetches.
# Usage: 02c_pilot_boundary_display.sh [input.geojson] [output.geojson]
#
# Two transformations, both of which make the result unfit for analysis and
# are the reason this is a separate artefact rather than the same file:
#
#   1. Simplify at 25 m. The map explorer never draws this above ~z12, where
#      25 m is well under a pixel; carrying 12 733 vertices into the browser
#      to render the same shape is just payload.
#   2. Reproject to EPSG:4326. MapLibre works in WGS84; sela stores in
#      EPSG:25832 (ADR-0002).
#
# 04_generate_grid.sql clips the hex grid against the full-precision
# EPSG:25832 file in ingest/pilot/, never this one. A simplified boundary
# would silently add and drop cells along the edge.
#
# Per ADR-0002 this is geometry work and belongs in the GDAL container.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INPUT="${1:-$REPO_ROOT/ingest/pilot/uckermark-12073.geojson}"
OUTPUT="${2:-$REPO_ROOT/public/pilot-uckermark.geojson}"
TOLERANCE_M=25

[ -f "$INPUT" ] || { echo "Missing $INPUT — run 02b_extract_pilot_boundary.sh first." >&2; exit 1; }
mkdir -p "$(dirname "$OUTPUT")"

# -simplify runs in the SOURCE units (metres, EPSG:25832) before -t_srs
# reprojects, which is why the tolerance can be stated in metres at all.
# RFC7946=YES is correct here and wrong in 02b: this output *is* WGS84, and
# RFC7946 also writes the bbox member the map uses to fit its initial view.
ogr2ogr -f GeoJSON "$OUTPUT" "$INPUT" \
  -simplify "$TOLERANCE_M" \
  -t_srs EPSG:4326 \
  -lco RFC7946=YES -lco COORDINATE_PRECISION=6 -lco WRITE_BBOX=YES \
  -overwrite

[ -s "$OUTPUT" ] || { echo "ogr2ogr produced no output" >&2; exit 1; }
echo "display boundary -> $OUTPUT"
echo "Attribution (BKG VG25, CC BY 4.0) is required wherever this renders —"
echo "see docs/data/sources.md §3; the map carries it via MapLibre's"
echo "attribution control, sourced from lib/basemap/basemap-source.ts."
