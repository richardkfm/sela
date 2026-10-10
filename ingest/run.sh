#!/bin/sh
set -eu
# Orchestrates the numbered ingest steps (roadmap §4.2), in order. Each step
# script is individually re-runnable; this just sequences them.
#
# Default (no flags): the real pipeline for REGION (default uckermark-12073;
# PILOT_REGION is the older name). A region is a Land (brandenburg-12,
# sachsen-14) or a Landkreis (uckermark-12073, or any <slug>-<ags> whose Land
# is configured in lib/pilot-region.ts) — ADR-0012. The federal sources are
# fetched for every region; the Land's own sources follow from the region's
# AGS. Sources whose docs/data/sources.md status is "confirmed" are fetched;
# sources still behind the licence gate are reported and skipped rather than
# aborting the run. Then ingest/real/ loads, grids, samples and writes
# criterion_value rows — see ingest/real/README.md.
#
# --fixture: runs the same grid-generation/sampling/write machinery against
# the synthetic data in ingest/fixtures/ instead, to prove the pipeline
# mechanics work without depending on an unconfirmed dataset. Never used in
# a real deployment.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
: "${DATABASE_URL:?DATABASE_URL is not set}"

# `docker compose run ingest -- --fixture` may hand the `--` through to this
# script; without this shift it would start the real (≈ 1 GB) run instead.
if [ "${1:-}" = "--" ]; then
  shift
fi

MODE="real"
if [ "${1:-}" = "--fixture" ]; then
  MODE="fixture"
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/00_staging_schema.sql"

if [ "$MODE" = "real" ]; then
  PILOT_REGION="${REGION:-${PILOT_REGION:-uckermark-12073}}"
  CELL_SIZE="${CELL_SIZE:-100}"
  export PILOT_REGION
  REGION="$PILOT_REGION"
  export REGION
  AGS="${PILOT_REGION##*-}"
  case "$AGS" in
    [0-9][0-9] | [0-9][0-9][0-9][0-9][0-9]) ;;
    *) echo "REGION '$PILOT_REGION' must end in a two-digit Land key or a five-digit Kreis key (e.g. sachsen-14, uckermark-12073)." >&2; exit 1 ;;
  esac
  LAND_AGS=$(printf '%s' "$AGS" | cut -c1-2)
  # The Land's own sources (lib/pilot-region.ts LAENDER, docs/data/sources.md).
  case "$LAND_AGS" in
    12) LAND_SOURCES="lfu-bb-schutzgebiete lbgr-bb-moorbodenkarte lfu-bb-biotopkataster lfu-bb-wasserhaushalt"
        PROTECTION_SOURCE="lfu-bb-schutzgebiete" ;;
    14) LAND_SOURCES="lfulg-sn-schutzgebiete"
        PROTECTION_SOURCE="lfulg-sn-schutzgebiete" ;;
    *) echo "No Land configured for AGS prefix '$LAND_AGS' — add it to lib/pilot-region.ts LAENDER, ingest/real/14_protection.sh, 19_regions.sh and here." >&2; exit 1 ;;
  esac
  echo "== real ingest run: $PILOT_REGION (Land $LAND_AGS) =="
  FETCHED=""
  SKIPPED=""
  for source_id in bkg-vg25 bkg-clc5 dwd-cdc-radiation bkg-dgm200 $LAND_SOURCES bfn-schutzgebiete osm-geofabrik; do
    # `set -e` must not kill the run on a gated source: a blocked licence (1)
    # or a confirmed source whose fetch is not written yet (3) is an expected
    # state of this pipeline, not a failure. Anything else — a pin mismatch
    # (4) or a failed transfer (5) — aborts before any load step runs.
    rc=0
    "$SCRIPT_DIR/01_fetch.sh" "$source_id" || rc=$?
    case "$rc" in
      0) FETCHED="$FETCHED $source_id" ;;
      1|3) SKIPPED="$SKIPPED $source_id" ;;
      *) echo "01_fetch.sh '$source_id' failed with exit $rc — stopping." >&2; exit "$rc" ;;
    esac
  done
  echo "== fetch summary =="
  echo "  fetched:${FETCHED:- (none)}"
  echo "  skipped (gated or not implemented):${SKIPPED:- (none)}"
  case " $FETCHED " in
    *" $PROTECTION_SOURCE "*) ;;
    *) echo "The Land's protected-area source '$PROTECTION_SOURCE' was not fetched; without it no PV class can be written. Stopping." >&2; exit 1 ;;
  esac

  # Load → grid → sample → write (ingest/real/README.md). Sources and criterion
  # definitions are seeded first: criterion_value rows reference both.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/seed_real_sources.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/real/seed_real_criteria.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/real/seed_nature_criteria.sql"
  "$SCRIPT_DIR/real/10_boundary.sh"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -v cell_size="$CELL_SIZE" \
    -f "$SCRIPT_DIR/04_generate_grid.sql"
  "$SCRIPT_DIR/real/11_clc5.sh"
  "$SCRIPT_DIR/real/12_dwd.sh"
  "$SCRIPT_DIR/real/13_dgm200.sh"
  "$SCRIPT_DIR/real/14_protection.sh"
  if [ "$LAND_AGS" = 12 ]; then
    "$SCRIPT_DIR/real/15_moorkarte.sh"
    "$SCRIPT_DIR/real/16_wasserhaushalt.sh"
  else
    echo "peat and water balance: no confirmed source for Land $LAND_AGS (docs/data/sources.md §2.14) — climate and water stay 'noch nicht eingelesen'"
  fi
  "$SCRIPT_DIR/real/17_municipalities.sh"
  if [ "$LAND_AGS" = 12 ]; then
    "$SCRIPT_DIR/real/18_biotopkataster.sh"
  else
    echo "biotopes: no confirmed source for Land $LAND_AGS (docs/data/sources.md §2.14) — habitat stays 'noch nicht eingelesen'"
  fi
  "$SCRIPT_DIR/real/19_regions.sh"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -v protection_source="$PROTECTION_SOURCE" \
    -f "$SCRIPT_DIR/real/20_sample.sql"
  if [ "$LAND_AGS" = 12 ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -f "$SCRIPT_DIR/real/20b_sample_nature.sql"
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -v method_version=real-v0 \
    -f "$SCRIPT_DIR/real/21_write_values.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -v protection_source="$PROTECTION_SOURCE" \
    -f "$SCRIPT_DIR/real/22_protection_overlap.sql"
  if [ "$LAND_AGS" = 12 ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -f "$SCRIPT_DIR/real/23_habitat_overlap.sql"
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -f "$SCRIPT_DIR/real/24_stamp_ags.sql"
  echo "real ingest run complete for $PILOT_REGION."
  echo "Next: pnpm db:materialize -- --region=$PILOT_REGION   (classified verdicts; cited outcome methods; overview pyramid)"
  exit 0
fi

echo "== fixture ingest run (synthetic data — see ingest/fixtures/README.md) =="
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

"$SCRIPT_DIR/02_reproject.sh" "$SCRIPT_DIR/fixtures/pilot_boundary.geojson" "$WORKDIR/pilot_boundary.geojson"
"$SCRIPT_DIR/03_load.sh" "$WORKDIR/pilot_boundary.geojson" "pilot_boundary"

"$SCRIPT_DIR/02_reproject.sh" "$SCRIPT_DIR/fixtures/land_cover_sample.geojson" "$WORKDIR/land_cover_sample.geojson"
"$SCRIPT_DIR/03_load.sh" "$WORKDIR/land_cover_sample.geojson" "land_cover_sample"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/fixtures/seed_fixture_definitions.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region='fixture-region' -v cell_size=100 \
  -f "$SCRIPT_DIR/04_generate_grid.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region='fixture-region' \
  -f "$SCRIPT_DIR/05_sample.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region='fixture-region' \
  -f "$SCRIPT_DIR/05b_sample_illustrative_variation.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region='fixture-region' -v method_version='fixture-v0' \
  -f "$SCRIPT_DIR/06_write_criterion_values.sql"

# The fixture's region row (ADR-0012): no AGS, no boundary, no parent.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "INSERT INTO region (id, kind, ags, name, bez) VALUES ('fixture-region', 'fixture', NULL, 'Beispieldatensatz', NULL) ON CONFLICT (id) DO NOTHING;
   UPDATE region SET unit_count = (SELECT count(*) FROM spatial_unit WHERE pilot_region = 'fixture-region') WHERE id = 'fixture-region';"

echo "fixture ingest run complete."
