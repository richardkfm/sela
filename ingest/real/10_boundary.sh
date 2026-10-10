#!/bin/sh
set -eu
# Loads the region's boundary into staging.pilot_boundary (ADR-0012). The
# committed files in ingest/regions/ are full-precision EPSG:25832 extractions
# from VG25 (ingest/regions/README.md): both Länder and the Uckermark. Any
# other Landkreis is cut from the fetched VG25 archive on the fly, with the
# same script that produced the committed files (02b_extract_pilot_boundary.sh),
# so no second way of reading a boundary exists.
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${REGION:-${PILOT_REGION:-uckermark-12073}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FILE="$REPO_ROOT/ingest/regions/$PILOT_REGION.geojson"

if [ ! -f "$FILE" ]; then
  AGS="${PILOT_REGION##*-}"
  SLUG="${PILOT_REGION%-*}"
  echo "no committed boundary for $PILOT_REGION — cutting AGS $AGS from the VG25 archive"
  "$SCRIPT_DIR/../02b_extract_pilot_boundary.sh" "$AGS" "$SLUG"
fi

ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$FILE" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES -overwrite -nln pilot_boundary \
  -a_srs EPSG:25832 -nlt MULTIPOLYGON \
  -dialect sqlite -sql "SELECT geometry, '$PILOT_REGION' AS pilot_region, name, bez, ags FROM \"$(ogrinfo -ro -q "$FILE" | sed -n 's/^1: \([^ ]*\).*/\1/p')\""
echo "loaded boundary for $PILOT_REGION ($(psql "$DATABASE_URL" -tA -c "SELECT round(ST_Area(geom) / 1e6) FROM staging.pilot_boundary WHERE pilot_region = '$PILOT_REGION'") km²)"
