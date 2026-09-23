#!/bin/sh
set -eu
# BKG DGM200 (dl-de/by-2-0) → slope in degrees → staging.dgm200_slope. The
# GeoTIFF is EPSG:25832 already; it is clipped to the pilot extent plus one
# pixel of margin (so edge slopes have neighbours), then gdaldem computes the
# slope. Raster math lives here, in the ingest step, per ADR-0002.
: "${DATABASE_URL:?DATABASE_URL is not set}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}/bkg-dgm200/dgm200.utm32s.geotiff.zip"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
EXTENT=$(psql "$DATABASE_URL" -tA -F' ' -c "SELECT ST_XMin(e)-400, ST_YMax(e)+400, ST_XMax(e)+400, ST_YMin(e)-400 FROM (SELECT ST_Extent(geom) e FROM staging.pilot_boundary) x")

# shellcheck disable=SC2086
gdal_translate -q -projwin $EXTENT "/vsizip/$RAW/dgm200.utm32s.geotiff/dgm200/dgm200_utm32s.tif" "$WORK/dgm.tif"
gdaldem slope -q -compute_edges "$WORK/dgm.tif" "$WORK/slope.tif"
psql "$DATABASE_URL" -q -c "CREATE EXTENSION IF NOT EXISTS postgis_raster; DROP TABLE IF EXISTS staging.dgm200_slope;"
raster2pgsql -c -s 25832 -t 64x64 -I "$WORK/slope.tif" staging.dgm200_slope | psql "$DATABASE_URL" -q
echo "loaded dgm200 slope"
