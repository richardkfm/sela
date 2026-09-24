#!/bin/sh
set -eu
# DWD CDC annual global radiation (CC BY 4.0) for the decided window
# (sources.manifest.json dwd-cdc-radiation.aggregation) into
# staging.dwd_radiation, one raster row per year, native EPSG:31467.
#
# DWD's .asc files carry a German metadata block before the standard ESRI
# ASCII header ("[ASCII-Raster-Format]"); GDAL cannot read them until it is
# stripped. The block's own Koordinatensystem line names Gauß-Krüger zone 3
# (Potsdam datum), which is EPSG:31467 — assigned explicitly, never guessed.
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$SCRIPT_DIR/../sources.manifest.json"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/dwd-cdc-radiation"
FIRST=$(jq -r '.sources["dwd-cdc-radiation"].aggregation.firstYear' "$MANIFEST")
LAST=$(jq -r '.sources["dwd-cdc-radiation"].aggregation.lastYear' "$MANIFEST")
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

psql "$DATABASE_URL" -q -c "CREATE EXTENSION IF NOT EXISTS postgis_raster; DROP TABLE IF EXISTS staging.dwd_radiation;"
year="$FIRST"
first=1
while [ "$year" -le "$LAST" ]; do
  unzip -o -q -d "$WORK" "$RAW/grids_germany_annual_radiation_global_$year.zip"
  src="$WORK/grids_germany_annual_radiation_global_$year.asc"
  grep -q '^Werte_Dimension=kWh/m2' "$src" || { echo "unexpected unit in $src" >&2; exit 1; }
  sed -n '/^NCOLS/,$p' "$src" | tr -d '\r' > "$WORK/$year.asc"
  mode="-a"; [ "$first" = 1 ] && mode="-c" && first=0
  raster2pgsql $mode -s 31467 -t 50x50 -F "$WORK/$year.asc" staging.dwd_radiation | psql "$DATABASE_URL" -q
  year=$((year + 1))
done
psql "$DATABASE_URL" -q -c "ALTER TABLE staging.dwd_radiation ADD COLUMN IF NOT EXISTS year int;
  UPDATE staging.dwd_radiation SET year = substring(filename from '^(\d{4})')::int;
  CREATE INDEX IF NOT EXISTS dwd_radiation_rast_idx ON staging.dwd_radiation USING gist (ST_ConvexHull(rast));"
echo "loaded dwd radiation $FIRST-$LAST: $(psql "$DATABASE_URL" -tA -c 'SELECT count(DISTINCT year) FROM staging.dwd_radiation') years"
