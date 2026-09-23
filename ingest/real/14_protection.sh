#!/bin/sh
set -eu
# LfU Brandenburg protected areas (dl-de/by-2-0, "© Landesamt für Umwelt
# Brandenburg") into staging.protection, reprojected from the service's
# EPSG:25833 to EPSG:25832. Curve polygons are linearised on the way in. The
# service's own caveat stands for every row: overview data, digitised at
# 1:10 000, not legally binding.
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/lfu-bb-schutzgebiete"

psql "$DATABASE_URL" -q -c "DROP TABLE IF EXISTS staging.protection"
for layer in nsg natp ffh spa lsg br; do
  file="$RAW/app_$layer.gpkg"
  table=$(ogrinfo -ro -q "$file" | sed -n 's/^1: \([^ ]*\).*/\1/p')
  ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$file" \
    -lco GEOMETRY_NAME=geom -nln staging.protection -append -update \
    -t_srs EPSG:25832 -nlt CONVERT_TO_LINEAR -nlt MULTIPOLYGON \
    -dialect sqlite -sql "SELECT the_geom, '$layer' AS category, Gebietsname AS name, Gebietsnummer AS area_code FROM \"$table\""
  echo "  protection: $layer loaded"
done
psql "$DATABASE_URL" -q -c "UPDATE staging.protection SET geom = ST_MakeValid(geom) WHERE NOT ST_IsValid(geom);
  CREATE INDEX IF NOT EXISTS protection_geom_idx ON staging.protection USING gist (geom); ANALYZE staging.protection;"
psql "$DATABASE_URL" -tA -c "SELECT category, count(*) FROM staging.protection GROUP BY 1 ORDER BY 1"
