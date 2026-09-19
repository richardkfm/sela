#!/bin/sh
set -eu
# Orchestrates the numbered ingest steps (roadmap §4.2), in order. Each step
# script is individually re-runnable; this just sequences them.
#
# Default (no flags): the real pipeline. Sources whose docs/data/sources.md
# status is "confirmed" are fetched; sources still behind the licence gate are
# reported and skipped rather than aborting the run, so a partially-confirmed
# manifest is still usable — see ingest/README.md.
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
  echo "== real ingest run =="
  FETCHED=""
  SKIPPED=""
  for source_id in bfn-schutzgebiete bkg-clc5 osm-geofabrik dwd-cdc-radiation; do
    # `set -e` must not kill the run on a gated source: a blocked licence (1)
    # or a confirmed source whose fetch is not written yet (3) is an expected
    # state of this pipeline, not a failure. Anything else still aborts.
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
  # Reproject/load/grid/sample/write for real sources are added below once the
  # per-source steps are written. They are deliberately absent rather than
  # stubbed: fetching a dataset is not the same as knowing how to sample it
  # onto the grid, and ADR-0004 exclusions must not be half-applied.
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

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v method_version='fixture-v0' \
  -f "$SCRIPT_DIR/06_write_criterion_values.sql"

echo "fixture ingest run complete."
