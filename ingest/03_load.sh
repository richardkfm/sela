#!/bin/sh
set -eu
# Step 3 (roadmap §4.2): load a reprojected vector file into PostGIS.
# Usage: 03_load.sh <file> <staging-table-name>
#
# `-overwrite` drops and recreates staging.<table> from the file's own
# schema each run — staging is rebuilt, not accumulated, which is what
# makes this step idempotent. The table shape (columns, geometry SRID) is
# therefore whatever the source file defines; nothing here pre-declares it.

FILE="${1:?usage: 03_load.sh <file> <staging-table-name>}"
TABLE="${2:?usage: 03_load.sh <file> <staging-table-name>}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES \
  -nln "$TABLE" -overwrite \
  "$FILE"

echo "loaded: $FILE -> staging.$TABLE"
