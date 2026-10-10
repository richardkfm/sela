#!/bin/sh
set -eu
# The Land's protected areas into staging.protection, one row per area with
# its category (nsg, natp, ffh, spa, lsg, br — the BNatSchG categories the
# decided rules name, ADR-0009), reprojected to EPSG:25832. Which Land's
# service is read follows from the region's AGS (ADR-0012):
#
#   12  LfU Brandenburg WFS (dl-de/by-2-0, "© Landesamt für Umwelt
#       Brandenburg"; docs/data/sources.md §2.8): six GeoPackages fetched by
#       01_fetch.sh, native EPSG:25833, curve polygons linearised on the way
#       in. Overview data, digitised at 1:10 000, not legally binding.
#   14  LfULG Sachsen downloads (dl-de/by-2-0, "Sächsisches Landesamt für
#       Umwelt, Landwirtschaft und Geologie"; sources.md §2.13): shapefiles in
#       zip archives, native EPSG:25833. The archives' own note: boundaries do
#       not necessarily follow parcel boundaries. FFH polygons without an EU
#       number are "technisch bedingte Inselflächen" per the archive's
#       documentation and are left out. Naturparke and Flächennaturdenkmäler
#       are not a category the rules name and are not loaded.
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${REGION:-${PILOT_REGION:-uckermark-12073}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/../../data/raw}"
LAND_AGS=$(printf '%s' "${PILOT_REGION##*-}" | cut -c1-2)

psql "$DATABASE_URL" -q -c "DROP TABLE IF EXISTS staging.protection"

load() {
  # load <file> <category> <sql field list ending in AS name, AS area_code> [where]
  file="$1"; category="$2"; fields="$3"; where="${4:-}"
  table=$(ogrinfo -ro -q "$file" | sed -n 's/^1: \([^ ]*\).*/\1/p')
  ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$file" \
    -lco GEOMETRY_NAME=geom -nln staging.protection -append -update \
    -t_srs EPSG:25832 -nlt CONVERT_TO_LINEAR -nlt MULTIPOLYGON -makevalid \
    -dialect sqlite -sql "SELECT geometry AS the_geom, '$category' AS category, $fields FROM \"$table\" $where"
  echo "  protection: $category loaded from $(basename "$file")"
}

case "$LAND_AGS" in
  12)
    RAW="$DATA_DIR/lfu-bb-schutzgebiete"
    for layer in nsg natp ffh spa lsg br; do
      load "$RAW/app_$layer.gpkg" "$layer" "Gebietsname AS name, Gebietsnummer AS area_code"
    done
    ;;
  14)
    RAW="$DATA_DIR/lfulg-sn-schutzgebiete"
    WORK="$(mktemp -d)"
    trap 'rm -rf "$WORK"' EXIT
    for archive in nsg nlp lsg br FFH_GrundschutzVO SPA_Okt_2006_Dez_2009; do
      unzip -o -q "$RAW/$archive.zip" -d "$WORK/$archive"
    done
    # The LfULG attribute tables: NAME and SG_NR (landesweiter Code) for the
    # BNatSchG categories; GEBIET and EU_NR for the Natura 2000 layers.
    load "$(find "$WORK/nsg" -name 'nsg.shp')" nsg "NAME AS name, SG_NR AS area_code"
    load "$(find "$WORK/nlp" -name 'nlp.shp')" natp "NAME AS name, SG_NR AS area_code"
    load "$(find "$WORK/lsg" -name 'lsg.shp')" lsg "NAME AS name, SG_NR AS area_code"
    load "$(find "$WORK/br" -name 'br.shp')" br "NAME AS name, SG_NR AS area_code"
    load "$(find "$WORK/FFH_GrundschutzVO" -name 'ffh_gsvo_f.shp')" ffh "GEBIET AS name, EU_NR AS area_code" \
      "WHERE EU_NR IS NOT NULL AND EU_NR <> ''"
    load "$(find "$WORK/SPA_Okt_2006_Dez_2009" -name 'spa.shp')" spa "GEBIET AS name, EU_NR AS area_code"
    ;;
  *)
    echo "No protected-area source configured for Land AGS '$LAND_AGS' (lib/pilot-region.ts LAENDER)." >&2
    exit 1
    ;;
esac

psql "$DATABASE_URL" -q -c "UPDATE staging.protection SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3)) WHERE NOT ST_IsValid(geom);
  DELETE FROM staging.protection WHERE geom IS NULL OR ST_IsEmpty(geom);
  CREATE INDEX IF NOT EXISTS protection_geom_idx ON staging.protection USING gist (geom); ANALYZE staging.protection;"
psql "$DATABASE_URL" -tA -c "SELECT category, count(*) FROM staging.protection GROUP BY 1 ORDER BY 1"
