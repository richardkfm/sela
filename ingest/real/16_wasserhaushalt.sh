#!/bin/sh
set -eu
# LfU Brandenburg Wasserhaushaltsgrößen 1991–2020 (ArcEGMO-PSCN, dl-de/by-2-0,
# "Landesamt für Umwelt Brandenburg", Stand 10.03.2023) into
# staging.water_balance — only Elementarflächen touching the pilot boundary's
# extent, read straight from the zip, reprojected from EPSG:25833 to 25832.
# Fields per the archive's own documentation (dok/doku_efl20_pscn.pdf, Tab. 1):
# GWN_91_20 percolation (mm/a), NFK_91_20 root-zone soil moisture (%nFK),
# LANDNUTZ land-use class (Tab. 2), HYD_NAME hydrotope class (Tab. 3).
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/lfu-bb-wasserhaushalt/arcegmo_wh_91-20.zip"
# The spatial filter is given in the file's own EPSG:25833: ogr2ogr does not
# accept -spat_srs together with -sql.
EXTENT=$(psql "$DATABASE_URL" -tA -F' ' -c "SELECT ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e) FROM (SELECT ST_Transform(ST_SetSRID(ST_Extent(geom)::geometry, 25832), 25833) e FROM staging.pilot_boundary) x")

psql "$DATABASE_URL" -q -c "DROP TABLE IF EXISTS staging.water_balance"
# shellcheck disable=SC2086
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "/vsizip/$RAW/wh_efl20_pscn.shp" \
  -lco GEOMETRY_NAME=geom -nln staging.water_balance -nlt MULTIPOLYGON \
  -spat $EXTENT -t_srs EPSG:25832 \
  -sql "SELECT LANDNUTZ AS land_use, HYD_NAME AS hydrotope, GWN_91_20 AS percolation_mm, NFK_91_20 AS soil_moisture_nfk FROM wh_efl20_pscn"
psql "$DATABASE_URL" -q -c "
  UPDATE staging.water_balance SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) WHERE NOT ST_IsValid(geom);
  CREATE INDEX IF NOT EXISTS water_balance_geom_idx ON staging.water_balance USING gist (geom);
  ANALYZE staging.water_balance;"
echo "loaded water balance: $(psql "$DATABASE_URL" -tA -c 'SELECT count(*) FROM staging.water_balance') Elementarflächen"
