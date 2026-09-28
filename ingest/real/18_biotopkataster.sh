#!/bin/sh
set -eu
# Roadmap Step 4: the LfU Biotopkataster (docs/data/sources.md §2.12), cut to
# the pilot region. The archive holds three shapefiles in EPSG:25833 —
# polygons (bbk_fl), lines (bbk_li, e.g. hedges, ditches) and points (bbk_pu,
# e.g. small ponds) — all three are loaded: a protected hedge on a field is as
# much a fact about the cell as a protected meadow. Reprojected to EPSG:25832
# here, in the GDAL container (ADR-0002).
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${PILOT_REGION:-uckermark-12073}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"
ARCHIVE="$DATA_DIR/lfu-bb-biotopkataster/biotope_lrt.zip"

if [ ! -f "$ARCHIVE" ]; then
  echo "Missing $ARCHIVE — run 01_fetch.sh lfu-bb-biotopkataster first; skipping (habitat stays 'noch nicht modelliert')." >&2
  exit 0
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
unzip -o -q "$ARCHIVE" 'bbk_fl.*' 'bbk_li.*' 'bbk_pu.*' -d "$WORKDIR"

# The pilot region's extent in the storage CRS; features outside it are not loaded.
EXTENT=$(psql "$DATABASE_URL" -tA -F ' ' -c \
  "SELECT floor(ST_XMin(e)), floor(ST_YMin(e)), ceil(ST_XMax(e)), ceil(ST_YMax(e))
   FROM (SELECT ST_Extent(geom) AS e FROM spatial_unit WHERE pilot_region = '$PILOT_REGION') x")

for layer in bbk_fl bbk_li bbk_pu; do
  case "$layer" in
    bbk_fl) nlt=MULTIPOLYGON ;;
    bbk_li) nlt=MULTILINESTRING ;;
    bbk_pu) nlt=MULTIPOINT ;;
  esac
  # shellcheck disable=SC2086 # EXTENT is four numbers on purpose
  ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$WORKDIR/$layer.shp" \
    -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES -overwrite -nln "$layer" \
    -s_srs EPSG:25833 -t_srs EPSG:25832 -nlt "$nlt" -makevalid \
    -spat_srs EPSG:25832 -spat $EXTENT \
    -select PK_IDENT,BIOTYP,BIOTYP_T,BBGNAT,BBGNAT_T,FFHLRT,FFHLRT_T,FFHGES,INTEN,DATUM_E,DATUM_F
  echo "  staged $layer: $(psql "$DATABASE_URL" -tA -c "SELECT count(*) FROM staging.$layer")"
done
