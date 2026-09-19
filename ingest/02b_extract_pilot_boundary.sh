#!/bin/sh
set -eu
# Step 2b (roadmap §4.2): cut the pilot region's boundary out of the fetched
# BKG VG25 archive. Usage: 02b_extract_pilot_boundary.sh [ags] [pilot_region]
#
# Defaults to AGS 12073 — Landkreis Uckermark, Brandenburg — the pilot region
# recorded in docs/architecture/roadmap-to-first-deployment.md §2.3.
#
# VG25 is already EPSG:25832 (ADR-0002's storage CRS), so no reprojection
# happens here and 02_reproject.sh is a no-op on the result. Per ADR-0002 this
# is geometry work and therefore belongs in the GDAL container, never in
# TypeScript.
#
# The committed ingest/pilot/uckermark-12073.geojson is the output of this
# step. It is committed so the pipeline runs without the 325 MB fetch; re-run
# this to regenerate it, or to cut a different Landkreis.

AGS="${1:-12073}"
PILOT_REGION="${2:-uckermark}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"

ARCHIVE="$DATA_DIR/bkg-vg25/vg25.utm32s.gpkg.zip"
if [ ! -f "$ARCHIVE" ]; then
  echo "Missing $ARCHIVE — run 01_fetch.sh bkg-vg25 first." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
unzip -o -q "$ARCHIVE" -d "$WORKDIR"
GPKG="$WORKDIR/vg25_ebenen/DE_VG25.gpkg"

OUT="$REPO_ROOT/ingest/pilot/$PILOT_REGION-$AGS.geojson"
mkdir -p "$(dirname "$OUT")"

# -a_srs is deliberately absent: the layer already carries EPSG:25832 and
# restating it would invite a silent mismatch if BKG ever changes the product.
# -sql selects the row and renames the columns in one pass, so no layer name
# and no -where is given: ogr2ogr rejects combining them with -sql.
# RFC7946=NO is load-bearing — RFC7946=YES would silently reproject to WGS84,
# which is exactly what this step must not do.
ogr2ogr -f GeoJSON "$OUT" "$GPKG" \
  -sql "SELECT AGS, ARS, GEN AS name, BEZ AS bez, NUTS, '$PILOT_REGION' AS pilot_region, '© BKG <Jahr> CC BY 4.0' AS attribution, 'https://creativecommons.org/licenses/by/4.0' AS attribution_url FROM vg25_krs WHERE AGS = '$AGS'" \
  -lco RFC7946=NO -lco COORDINATE_PRECISION=2 \
  -overwrite

if [ ! -s "$OUT" ]; then
  echo "ogr2ogr produced no output for AGS '$AGS' — is that a real Kreis key?" >&2
  exit 1
fi

echo "extracted AGS $AGS -> $OUT"
echo "Attribution is mandatory wherever this reaches a screen or an export:"
echo "  © BKG (<Jahr des letzten Datenbezugs>) CC BY 4.0, Datenquellen:"
echo "  https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf"
