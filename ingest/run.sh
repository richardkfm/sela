#!/bin/sh
set -eu
# Orchestrates the numbered ingest steps (roadmap §4.2), in order. Each step
# script is individually re-runnable; this just sequences them.
#
# Default (no flags): the real pipeline. As of this writing every candidate
# dataset in docs/data/sources.md is still "to_confirm" or "unconfirmed", so
# this always stops at the fetch gate — see ingest/README.md.
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
  for source_id in bfn-schutzgebiete bkg-clc5 osm-geofabrik dwd-cdc-radiation; do
    "$SCRIPT_DIR/01_fetch.sh" "$source_id"
  done
  # Unreachable while every source above is unconfirmed — 01_fetch.sh exits
  # non-zero and `set -e` stops the script. Reproject/load/grid/sample/write
  # for real sources are added here once fetch actually produces files.
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
