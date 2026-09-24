#!/bin/sh
set -eu
# LBGR Moorbodenkarte 2021 (dl-de/by-2-0, "© Landesamt für Bergbau, Geologie
# und Rohstoffe Brandenburg") into staging.peat_soil and staging.peat_carbon,
# reprojected from the service's EPSG:25833 to EPSG:25832. The 2021 layers are
# a modelled state derived from a 10 m grid (docs/data/sources.md §2.9).
#
# Kohlenstoffvorrat is published as a string: whole kg/m², or "< 0,5". The
# number is read from Wert_gerundet; "< 0,5" (Wert_gerundet = 0) becomes 0.25,
# the middle of the only interval the publisher states for it.
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/lbgr-bb-moorbodenkarte"

psql "$DATABASE_URL" -q -c "DROP TABLE IF EXISTS staging.peat_soil; DROP TABLE IF EXISTS staging.peat_carbon"
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$RAW/app_bodentyp_2021.gpkg" \
  -lco GEOMETRY_NAME=geom -nln staging.peat_soil -t_srs EPSG:25832 -nlt CONVERT_TO_LINEAR -nlt MULTIPOLYGON \
  -dialect sqlite -sql 'SELECT the_geom, Kurzzeichen AS code, Bezeichnung AS label FROM "app:bodentyp_2021"'
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$RAW/app_kohlenstoff_2021.gpkg" \
  -lco GEOMETRY_NAME=geom -nln staging.peat_carbon -t_srs EPSG:25832 -nlt CONVERT_TO_LINEAR -nlt MULTIPOLYGON \
  -dialect sqlite -sql 'SELECT the_geom, Wert AS published, CASE WHEN Wert_gerundet = 0 THEN 0.25 ELSE Wert_gerundet END AS kg_c_per_m2 FROM "app:kohlenstoff_2021"'
psql "$DATABASE_URL" -q -c "
  UPDATE staging.peat_soil SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) WHERE NOT ST_IsValid(geom);
  UPDATE staging.peat_carbon SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) WHERE NOT ST_IsValid(geom);
  CREATE INDEX IF NOT EXISTS peat_soil_geom_idx ON staging.peat_soil USING gist (geom);
  CREATE INDEX IF NOT EXISTS peat_carbon_geom_idx ON staging.peat_carbon USING gist (geom);
  ANALYZE staging.peat_soil; ANALYZE staging.peat_carbon;"
echo "loaded peat soil: $(psql "$DATABASE_URL" -tA -c 'SELECT count(*) FROM staging.peat_soil') polygons, carbon: $(psql "$DATABASE_URL" -tA -c 'SELECT count(*) FROM staging.peat_carbon') polygons"
