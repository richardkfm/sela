#!/bin/sh
set -eu
# Orchestrates the numbered ingest steps (roadmap §4.2), in order. Each step
# script is individually re-runnable; this just sequences them.
#
# Default (no flags): the real pipeline for PILOT_REGION (default
# uckermark-12073). Sources whose docs/data/sources.md status is "confirmed" are
# fetched; sources still behind the licence gate are reported and skipped
# rather than aborting the run. Then ingest/real/ loads, grids, samples and
# writes criterion_value rows — see ingest/real/README.md.
#
# --fixture: runs the same grid-generation/sampling/write machinery against
# the synthetic data in ingest/fixtures/ instead, to prove the pipeline
# mechanics work without depending on an unconfirmed dataset. Never used in
# a real deployment.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
: "${DATABASE_URL:?DATABASE_URL is not set}"

MODE="real"
if [ "${1:-}" = "--fixture" ]; then
  MODE="fixture"
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/00_staging_schema.sql"

if [ "$MODE" = "real" ]; then
  PILOT_REGION="${PILOT_REGION:-uckermark-12073}"
  CELL_SIZE="${CELL_SIZE:-100}"
  export PILOT_REGION
  echo "== real ingest run: $PILOT_REGION =="
  FETCHED=""
  SKIPPED=""
  for source_id in bkg-vg25 bkg-clc5 dwd-cdc-radiation bkg-dgm200 lfu-bb-schutzgebiete lbgr-bb-moorbodenkarte \
      lfu-bb-wasserhaushalt bfn-schutzgebiete osm-geofabrik; do
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
  "$SCRIPT_DIR/real/15_moorkarte.sh"
  "$SCRIPT_DIR/real/16_wasserhaushalt.sh"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -f "$SCRIPT_DIR/real/20_sample.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -f "$SCRIPT_DIR/real/20b_sample_nature.sql"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pilot_region="$PILOT_REGION" -v method_version=real-v0 \
    -f "$SCRIPT_DIR/real/21_write_values.sql"
  echo "real ingest run complete for $PILOT_REGION."
  echo "Next: pnpm db:materialize -- --pilot-region=$PILOT_REGION   (illustrative weights; cited outcome methods)"
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

echo "fixture ingest run complete."
