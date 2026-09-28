#!/bin/sh
# Docker installer for sela (ADR-0011). Pulls the prebuilt images from GHCR,
# starts sela with Docker Compose, waits for it to answer, and loads the data
# you choose. Run from a clone of the repository; see usage() or --help.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

APP_URL="http://localhost:3000"
REAL_REGION="uckermark-12073"
DATA=""
BUILD=0

say() { printf '%s\n' "$*"; }
step() { printf '\n== %s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: scripts/install.sh [--data fixture|uckermark|none] [--build]

  (no options)       ask which data to load
  --data fixture     synthetic test data — small and fast, not a real place
  --data uckermark   the real Landkreis Uckermark — ≈ 1 GB download, several minutes
  --data none        start the app and the database only
  --build            build the images from this checkout instead of pulling them

Run it again to update to the newest images. SELA_VERSION=0.3.0 (in the
environment or .env) pins a released version instead of `latest`.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --data)
      [ $# -ge 2 ] || die "--data needs a value: fixture, uckermark or none"
      DATA="$2"
      shift 2
      ;;
    --data=*) DATA="${1#--data=}"; shift ;;
    --build) BUILD=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option '$1' (see --help)" ;;
  esac
done

case "$DATA" in
  "" | fixture | uckermark | none) ;;
  *) die "--data must be fixture, uckermark or none, not '$DATA'" ;;
esac

# --- Prerequisites ----------------------------------------------------------
command -v docker >/dev/null 2>&1 \
  || die "Docker is not installed — see https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 \
  || die "Docker Compose v2 is missing ('docker compose version' failed) — install the Compose plugin or a current Docker Desktop"
docker info >/dev/null 2>&1 \
  || die "Docker is installed but not running — start Docker Desktop or the Docker daemon, then run this again"

# --- Which data: asked first, so everything after it runs unattended --------
if [ -z "$DATA" ]; then
  [ -t 0 ] || die "not running interactively — pass --data fixture, --data uckermark or --data none"
  say "Which data should sela load?"
  say "  1) Synthetic test data — small and fast, not a real place (default)"
  say "  2) Real Landkreis Uckermark — downloads ≈ 1 GB from the publishers, takes several minutes"
  say "  3) None — start the app and the database only"
  printf 'Choice [1]: '
  read -r answer || answer=""
  case "$answer" in
    "" | 1) DATA=fixture ;;
    2) DATA=uckermark ;;
    3) DATA=none ;;
    *) die "unknown choice '$answer' — expected 1, 2 or 3" ;;
  esac
fi

# The published images are amd64 only (ADR-0011). On an arm64 machine (Apple
# Silicon, Raspberry Pi) Docker runs them under emulation once told to.
if [ "$BUILD" -eq 0 ] && [ -z "${DOCKER_DEFAULT_PLATFORM:-}" ]; then
  case "$(uname -m)" in
    arm64 | aarch64)
      DOCKER_DEFAULT_PLATFORM=linux/amd64
      export DOCKER_DEFAULT_PLATFORM
      say "note: the published images are amd64 only; on this $(uname -m) machine they run under emulation, which is slower."
      ;;
  esac
fi

# Compose with the ingest profile only when data is to be loaded — never for
# `up`, which would otherwise start the ingest services as well.
compose_all() {
  if [ "$DATA" = none ]; then
    docker compose "$@"
  else
    docker compose --profile ingest "$@"
  fi
}

if [ ! -f .env ]; then
  cp .env.example .env
  say "created .env from .env.example"
fi

# --- Images -----------------------------------------------------------------
if [ "$BUILD" -eq 1 ]; then
  step "Building the images from this checkout (several minutes the first time)"
  compose_all build
else
  step "Pulling the sela images from ghcr.io"
  # A failed pull may exit non-zero or only warn, depending on the Compose
  # version; either way, check that every image really is here before
  # `up --no-build`, and say what to do if one is not.
  compose_all pull || true
  missing=""
  for image in $(compose_all config --images); do
    docker image inspect "$image" >/dev/null 2>&1 || missing="$missing $image"
  done
  [ -z "$missing" ] || die "could not pull:$missing
ghcr.io answers \"denied\" both for a private package and for one that does not
exist yet. Right after a push to main, wait for the \"Publish images\" workflow
(https://github.com/richardkfm/sela/actions) to finish, then run this again.
Otherwise build from this checkout instead: scripts/install.sh --build"
fi

# --- Start --------------------------------------------------------------------
step "Starting sela (database, migrations, app)"
if [ "$BUILD" -eq 1 ]; then
  docker compose up -d
else
  docker compose up -d --no-build
fi

step "Waiting for $APP_URL"
app_is_up() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null "$APP_URL/api/health" 2>/dev/null
  else
    wget -q -O /dev/null "$APP_URL/api/health" 2>/dev/null
  fi
}
if command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1; then
  tries=0
  until app_is_up; do
    tries=$((tries + 1))
    [ "$tries" -lt 60 ] \
      || die "the app did not answer on $APP_URL/api/health within 2 minutes — see: docker compose logs app"
    sleep 2
  done
  say "the app answers."
else
  say "neither curl nor wget found — not waiting for the health check."
fi

# --- Data ---------------------------------------------------------------------
case "$DATA" in
  fixture)
    step "Loading the synthetic test data"
    docker compose --profile ingest run --rm ingest --fixture
    step "Materialising scores for fixture-region"
    SELA_MATERIALIZE_REGION=fixture-region docker compose --profile ingest run --rm materialize
    ;;
  uckermark)
    step "Loading the Landkreis Uckermark (≈ 1 GB download from the publishers)"
    docker compose --profile ingest run --rm ingest
    step "Materialising scores for $REAL_REGION"
    SELA_MATERIALIZE_REGION="$REAL_REGION" docker compose --profile ingest run --rm materialize
    ;;
esac

step "sela is running"
say "  Open:    $APP_URL"
if [ "$DATA" = none ]; then
  say "  Data:    none loaded — run this again with --data fixture or --data uckermark"
fi
say "  Logs:    docker compose logs -f app"
say "  Stop:    docker compose down      (add -v to delete the database as well)"
say "  Update:  scripts/install.sh"
say ""
say "sela is advisory: it informs discussion; it does not grant or predict planning permission."
