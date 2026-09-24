#!/bin/sh
set -eu
# Loads the real pilot boundary into staging.pilot_boundary. The committed file
# is the full-precision EPSG:25832 extraction from VG25 (ingest/pilot/README.md);
# the simplified public/ copy is display-only and never used here.
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${PILOT_REGION:-uckermark-12073}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$SCRIPT_DIR/../pilot/$PILOT_REGION.geojson"

ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$FILE" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES -overwrite -nln pilot_boundary \
  -a_srs EPSG:25832 -nlt MULTIPOLYGON \
  -dialect sqlite -sql "SELECT geometry, '$PILOT_REGION' AS pilot_region FROM \"$(ogrinfo -ro -q "$FILE" | sed -n 's/^1: \([^ ]*\).*/\1/p')\""
echo "loaded boundary for $PILOT_REGION"
