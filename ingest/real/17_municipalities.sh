#!/bin/sh
set -eu
# Roadmap Step 5 (mvp.md F1): the pilot region's Gemeinde boundaries, from the
# BKG VG25 archive the pilot boundary already comes from (docs/data/sources.md
# §2.5) — layer `vg25_gem`, the rows whose AGS starts with the Kreis key and
# whose Geofaktor is 9 ("mit Struktur": exactly one row per administrative
# unit, per the product documentation vg25.pdf inside the archive).
#
# VG25 is EPSG:25832, ADR-0002's storage CRS, so nothing is reprojected. Per
# ADR-0002 this is geometry work and stays in the GDAL container.
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${PILOT_REGION:-uckermark-12073}"
# The Kreis key is the trailing AGS of the pilot region id (uckermark-12073 → 12073).
KREIS_AGS="${KREIS_AGS:-${PILOT_REGION##*-}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"
ARCHIVE="$DATA_DIR/bkg-vg25/vg25.utm32s.gpkg.zip"

case "$KREIS_AGS" in
  [0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "KREIS_AGS '$KREIS_AGS' is not a five-digit Kreis key — set KREIS_AGS." >&2; exit 1 ;;
esac

if [ ! -f "$ARCHIVE" ]; then
  echo "Missing $ARCHIVE — run 01_fetch.sh bkg-vg25 first; skipping Gemeinden (search by Gemeinde stays empty)." >&2
  exit 0
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
# Random access into a 500 MB deflated GeoPackage through /vsizip/ is far
# slower than unpacking it once.
unzip -o -q "$ARCHIVE" 'vg25_ebenen/DE_VG25.gpkg' -d "$WORKDIR"

# The staging name must differ from the public table: ogr2ogr -overwrite
# matches layers by bare name and would drop public.municipality.
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$WORKDIR/vg25_ebenen/DE_VG25.gpkg" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES -overwrite -nln vg25_gem \
  -nlt MULTIPOLYGON \
  -sql "SELECT geom, AGS AS ags, GEN AS name, BEZ AS kind FROM vg25_gem WHERE AGS LIKE '$KREIS_AGS%' AND GF = 9"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v pilot_region="$PILOT_REGION" <<'SQL'
BEGIN;
DELETE FROM municipality WHERE pilot_region = :'pilot_region';
INSERT INTO municipality (ags, pilot_region, name, kind, geom, source_id)
SELECT ags, :'pilot_region', name, kind, ST_Multi(geom)::geometry(MultiPolygon, 25832), 'bkg-vg25'
FROM staging.vg25_gem;
COMMIT;
SQL
echo "loaded $(psql "$DATABASE_URL" -tA -c "SELECT count(*) FROM municipality WHERE pilot_region = '$PILOT_REGION'") Gemeinden for $PILOT_REGION"
