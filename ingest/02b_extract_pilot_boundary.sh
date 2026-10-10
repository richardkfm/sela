#!/bin/sh
set -eu
# Step 2b (roadmap §4.2; ADR-0012): cut a region's boundary out of the fetched
# BKG VG25 archive. Usage: 02b_extract_pilot_boundary.sh [ags] [slug]
#
# A two-digit AGS is a Land (layer vg25_lan), a five-digit one a Kreis
# (vg25_krs). Defaults to AGS 12073 — Landkreis Uckermark, Brandenburg — the
# region recorded in docs/architecture/roadmap-to-first-deployment.md §2.3.
#
# VG25 is already EPSG:25832 (ADR-0002's storage CRS), so no reprojection
# happens here and 02_reproject.sh is a no-op on the result. Per ADR-0002 this
# is geometry work and therefore belongs in the GDAL container, never in
# TypeScript.
#
# The committed ingest/regions/*.geojson files are the output of this step.
# They are committed so the pipeline runs without the 325 MB fetch; re-run
# this to regenerate one, or to cut any other Landkreis (10_boundary.sh does
# so itself when no committed file exists).

AGS="${1:-12073}"
SLUG="${2:-uckermark}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"

case "$AGS" in
  [0-9][0-9]) LAYER=vg25_lan; KIND=land ;;
  [0-9][0-9][0-9][0-9][0-9]) LAYER=vg25_krs; KIND=kreis ;;
  *) echo "AGS '$AGS' is neither a two-digit Land key nor a five-digit Kreis key." >&2; exit 1 ;;
esac

ARCHIVE="$DATA_DIR/bkg-vg25/vg25.utm32s.gpkg.zip"
if [ ! -f "$ARCHIVE" ]; then
  echo "Missing $ARCHIVE — run 01_fetch.sh bkg-vg25 first." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
# Random access into a 500 MB deflated GeoPackage through /vsizip/ is far
# slower than unpacking it once.
unzip -o -q "$ARCHIVE" 'vg25_ebenen/DE_VG25.gpkg' -d "$WORKDIR"
GPKG="$WORKDIR/vg25_ebenen/DE_VG25.gpkg"
STAND=$(unzip -p "$ARCHIVE" 'vg25_ebenen/aktualitaet.txt' 2>/dev/null | tr -d '\r' | sed -n 's/.*\([0-9][0-9]\)\.\([0-9][0-9]\)\.\([0-9][0-9][0-9][0-9]\).*/\3-\2-\1/p' | head -1)
RETRIEVED=$(date -u +%Y-%m-%d)

OUT="$REPO_ROOT/ingest/regions/$SLUG-$AGS.geojson"
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

# -a_srs is deliberately absent: the layer already carries EPSG:25832 and
# restating it would invite a silent mismatch if BKG ever changes the product.
# `geom` is named in the SELECT: OGR's SQL dialect drops the geometry from a
# GeoPackage when the field list leaves it out (found 2026-10-10 — the earlier
# version of this script wrote boundaries with a null geometry).
# RFC7946=NO is load-bearing — RFC7946=YES would silently reproject to WGS84,
# which is exactly what this step must not do. GF = 9 takes the one row "mit
# Struktur" per unit (vg25.pdf in the archive).
ogr2ogr -f GeoJSON "$OUT" "$GPKG" \
  -sql "SELECT geom, '$SLUG-$AGS' AS region_id, '$KIND' AS kind, GEN AS name, BEZ AS bez, AGS AS ags, ARS AS ars, NUTS AS nuts, 'BKG VG25' AS source, '${STAND:-unknown}' AS source_stand, 'CC BY 4.0' AS licence, '© BKG <Jahr> CC BY 4.0' AS attribution, 'https://creativecommons.org/licenses/by/4.0' AS attribution_url, '$RETRIEVED' AS retrieved FROM $LAYER WHERE AGS = '$AGS' AND GF = 9" \
  -lco RFC7946=NO -lco COORDINATE_PRECISION=2

if [ ! -s "$OUT" ] || ! ogrinfo -ro -so -al "$OUT" | grep -q "Feature Count: 1"; then
  echo "ogr2ogr produced no feature for AGS '$AGS' in $LAYER — is that a real key?" >&2
  rm -f "$OUT"
  exit 1
fi

echo "extracted AGS $AGS ($KIND) -> $OUT"
echo "Attribution is mandatory wherever this reaches a screen or an export:"
echo "  © BKG (<Jahr des letzten Datenbezugs>) CC BY 4.0, Datenquellen:"
echo "  https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf"
