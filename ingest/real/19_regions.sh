#!/bin/sh
set -eu
# ADR-0012: the `region` rows the explorer navigates — the region being
# ingested, its Land, and every Landkreis of that Land — with their VG25
# boundaries (CC BY 4.0). The region's own row comes from the committed
# boundary file (10_boundary.sh loaded it); the Land and its Kreise are read
# from the fetched VG25 archive. Without the archive only the region's own
# row (and its Land, without a boundary) is written, with a note.
#
# VG25 is EPSG:25832, ADR-0002's storage CRS, so nothing is reprojected.
: "${DATABASE_URL:?DATABASE_URL is not set}"
PILOT_REGION="${REGION:-${PILOT_REGION:-uckermark-12073}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"
ARCHIVE="$DATA_DIR/bkg-vg25/vg25.utm32s.gpkg.zip"

AGS="${PILOT_REGION##*-}"
LAND_AGS=$(printf '%s' "$AGS" | cut -c1-2)
case "$LAND_AGS" in
  12) LAND_ID=brandenburg-12; LAND_NAME=Brandenburg; LAND_BEZ=Land ;;
  14) LAND_ID=sachsen-14; LAND_NAME=Sachsen; LAND_BEZ=Freistaat ;;
  *) echo "No Land configured for AGS prefix '$LAND_AGS' (lib/pilot-region.ts LAENDER) — add it there and here first." >&2; exit 1 ;;
esac

# The Land row first (a Kreis references its parent), then the region's own
# row from the boundary just staged. ON CONFLICT keeps the row's identity and
# refreshes its geometry — a boundary change is one re-load (ADR-0010).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -v land_id="$LAND_ID" -v land_ags="$LAND_AGS" -v land_name="$LAND_NAME" -v land_bez="$LAND_BEZ" \
  -v pilot_region="$PILOT_REGION" -v ags="$AGS" <<'SQL'
INSERT INTO region (id, kind, ags, name, bez, parent_id, source_id)
VALUES (:'land_id', 'land', :'land_ags', :'land_name', :'land_bez', NULL, 'bkg-vg25')
ON CONFLICT (id) DO NOTHING;

INSERT INTO region (id, kind, ags, name, bez, parent_id, geom, source_id)
SELECT :'pilot_region',
       CASE WHEN length(:'ags') = 2 THEN 'land' ELSE 'kreis' END,
       :'ags',
       coalesce(max(name), :'pilot_region'),
       max(bez),
       CASE WHEN length(:'ags') = 2 THEN NULL ELSE :'land_id' END,
       ST_Multi(ST_Union(geom))::geometry(MultiPolygon, 25832),
       'bkg-vg25'
FROM staging.pilot_boundary WHERE pilot_region = :'pilot_region'
ON CONFLICT (id) DO UPDATE SET geom = EXCLUDED.geom, name = EXCLUDED.name, bez = EXCLUDED.bez, source_id = EXCLUDED.source_id;
SQL

if [ ! -f "$ARCHIVE" ]; then
  echo "Missing $ARCHIVE — the Land and its Kreise are registered without boundaries; run 01_fetch.sh bkg-vg25 and re-run for the full navigation." >&2
  exit 0
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
unzip -o -q "$ARCHIVE" 'vg25_ebenen/DE_VG25.gpkg' -d "$WORKDIR"
GPKG="$WORKDIR/vg25_ebenen/DE_VG25.gpkg"

# The staging names must differ from the public table: ogr2ogr -overwrite
# matches layers by bare name and would drop public.region.
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$GPKG" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -lco OVERWRITE=YES -overwrite -nln vg25_region \
  -nlt MULTIPOLYGON \
  -sql "SELECT geom, AGS AS ags, GEN AS name, BEZ AS bez, 'land' AS kind FROM vg25_lan WHERE AGS = '$LAND_AGS' AND GF = 9"
ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" "$GPKG" \
  -lco SCHEMA=staging -lco GEOMETRY_NAME=geom -nln vg25_region -append -update \
  -nlt MULTIPOLYGON \
  -sql "SELECT geom, AGS AS ags, GEN AS name, BEZ AS bez, 'kreis' AS kind FROM vg25_krs WHERE AGS LIKE '$LAND_AGS%' AND GF = 9"

# Region ids for Kreise are <slug>-<ags>, the slug derived from the name the
# way the committed ids are (uckermark-12073): lower-case ASCII, umlauts
# transliterated, everything else a hyphen.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -v land_id="$LAND_ID" -v land_ags="$LAND_AGS" <<'SQL'
BEGIN;
UPDATE region r SET geom = ST_Multi(v.geom)::geometry(MultiPolygon, 25832), name = v.name, bez = v.bez, source_id = 'bkg-vg25'
FROM staging.vg25_region v WHERE v.kind = 'land' AND r.id = :'land_id';

INSERT INTO region (id, kind, ags, name, bez, parent_id, geom, source_id)
SELECT trim(both '-' from regexp_replace(
         translate(lower(v.name), 'äöüß', 'aous'), '[^a-z0-9]+', '-', 'g')) || '-' || v.ags,
       'kreis', v.ags, v.name, v.bez, :'land_id', ST_Multi(v.geom)::geometry(MultiPolygon, 25832), 'bkg-vg25'
FROM staging.vg25_region v
WHERE v.kind = 'kreis'
ON CONFLICT (ags) DO UPDATE SET geom = EXCLUDED.geom, name = EXCLUDED.name, bez = EXCLUDED.bez, source_id = EXCLUDED.source_id;
COMMIT;
SQL
echo "registered $(psql "$DATABASE_URL" -tA -c "SELECT count(*) FROM region WHERE parent_id = '$LAND_ID'") Kreise of $LAND_NAME"
