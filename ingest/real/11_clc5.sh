#!/bin/sh
set -eu
# CLC5 2018 (BKG, dl-de/by-2-0) into staging.clc5 — only polygons touching the
# pilot boundary's extent, read straight from the zip (no 5 GB unpack). The
# archive is EPSG:25832 already (UTM32S), so nothing is reprojected. Only
# CLC18 is read: the shipped Shape_Area/Shape_Leng overflow their own declared
# numeric(18,11) for the largest polygons, and PostGIS recomputes both anyway.
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/bkg-clc5/clc5_2018.utm32s.shape.zip"
EXTENT=$(psql "$DATABASE_URL" -tA -F' ' -c "SELECT ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e) FROM (SELECT ST_Extent(geom) e FROM staging.pilot_boundary) x")

psql "$DATABASE_URL" -q -c "DROP TABLE IF EXISTS staging.clc5"
for class in 1xx 2xx 3xx 4xx 5xx; do
  layer="clc5_class$class"
  # shellcheck disable=SC2086
  ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "/vsizip/$RAW/clc5_2018.utm32s.shape/clc5/$layer.shp" \
    -lco GEOMETRY_NAME=geom -nln staging.clc5 -append -nlt MULTIPOLYGON \
    -spat $EXTENT -a_srs EPSG:25832 -update \
    -sql "SELECT CLC18 FROM $layer"
  echo "  clc5: $layer loaded"
done
psql "$DATABASE_URL" -q -c "CREATE INDEX IF NOT EXISTS clc5_geom_idx ON staging.clc5 USING gist (geom); ANALYZE staging.clc5;"
echo "loaded clc5: $(psql "$DATABASE_URL" -tA -c 'SELECT count(*) FROM staging.clc5') polygons"
