#!/bin/sh
# Docker installer for sela (ADR-0011). Pulls the prebuilt images from GHCR,
# starts sela with Docker Compose, waits for it to answer, and loads the data
# you choose. Run from a clone of the repository; see usage() or --help.
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

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
Ports: the first run picks the first free app port from 3000 up and saves it
to .env as SELA_APP_PORT (set it yourself to choose). The database gets no
fixed host port unless SELA_DB_PORT is set in .env.
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

# --- Ports --------------------------------------------------------------------
# After the images, because the final word on a port comes from Docker itself
# (probe_port below needs an image on this machine).

# A setting as Compose sees it: the shell's value wins over .env's.
env_value() { # NAME
  eval "value=\${$1:-}"
  if [ -z "$value" ]; then
    value=$(sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 \
      | sed "s/[[:space:]]*\$//; s/^[\"']//; s/[\"']\$//")
  fi
  printf '%s' "$value"
}

# The host port a sela service already publishes, if it is running.
own_port() { # SERVICE CONTAINER_PORT
  docker compose port "$1" "$2" 2>/dev/null | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p' | head -n 1
}

# Who holds a host port, when that can be seen cheaply: a container publishing
# it, or a listener on this machine (which includes containers using host
# networking — those show no port in `docker ps`). Prints nothing otherwise.
port_holder() { # PORT
  holder=$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ":$1->" | cut -d' ' -f1 | head -n 1)
  if [ -n "$holder" ]; then
    printf 'container %s' "$holder"
    return 0
  fi
  if [ -r /proc/net/tcp ]; then
    hex=$(printf ':%04X' "$1")
    if cat /proc/net/tcp /proc/net/tcp6 2>/dev/null \
      | awk -v h="$hex" '$4 == "0A" && substr($2, length($2) - 4) == h { found = 1 } END { exit !found }'; then
      printf 'a program or a host-network container'
    fi
  elif command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; then printf 'a program'; fi
  fi
  return 0
}

# The final word: can Docker publish this port right now? Starts a throwaway
# container with the same kind of mapping sela uses, which fails exactly when
# sela's own start would.
probe_port() { # BIND_ADDRESS PORT CONTAINER_PORT
  [ "$PROBE_OK" -eq 1 ] || return 0
  docker run --rm --entrypoint true -p "$1$2:$3" "$PROBE_IMAGE" >/dev/null 2>&1
}

port_free() { # BIND_ADDRESS PORT CONTAINER_PORT
  [ -z "$(port_holder "$2")" ] && probe_port "$1" "$2" "$3"
}

is_port_number() {
  case "$1" in "" | *[!0-9]*) return 1 ;; esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

PROBE_IMAGE=$(compose_all config --images 2>/dev/null | head -n 1)
[ -n "$PROBE_IMAGE" ] || PROBE_IMAGE="postgis/postgis:16-3.4"
# If a throwaway container cannot run at all, a failed probe would say nothing
# about ports; fall back to the checks above rather than reject every port.
PROBE_OK=1
docker run --rm --entrypoint true "$PROBE_IMAGE" >/dev/null 2>&1 || PROBE_OK=0

step "Choosing ports"
# App: a port set in .env (or the shell) is used as given, and only checked.
# Otherwise sela keeps the port it already runs on, or takes the first free one
# from 3000 up — and writes it to .env, so later runs keep it.
APP_PORT=$(env_value SELA_APP_PORT)
if [ -n "$APP_PORT" ]; then
  is_port_number "$APP_PORT" || die "SELA_APP_PORT must be a port number, not '$APP_PORT'"
  if [ "$(own_port app 3000)" != "$APP_PORT" ] && ! port_free "" "$APP_PORT" 3000; then
    holder=$(port_holder "$APP_PORT")
    die "port $APP_PORT (SELA_APP_PORT) is already in use on this machine${holder:+ ($holder)}.
Change SELA_APP_PORT in .env, or delete that line and this installer picks a
free port itself. Then run this again."
  fi
  say "app port: $APP_PORT (SELA_APP_PORT)"
else
  APP_PORT=$(own_port app 3000)
  if [ -z "$APP_PORT" ]; then
    candidate=3000
    while [ "$candidate" -lt 3100 ]; do
      if port_free "" "$candidate" 3000; then
        APP_PORT=$candidate
        break
      fi
      candidate=$((candidate + 1))
    done
    [ -n "$APP_PORT" ] || die "no free port between 3000 and 3099 — set SELA_APP_PORT in .env to one that is free"
  fi
  printf '\n# Chosen by scripts/install.sh; change it freely.\nSELA_APP_PORT=%s\n' "$APP_PORT" >> .env
  SELA_APP_PORT=$APP_PORT
  export SELA_APP_PORT
  say "app port: $APP_PORT (saved to .env as SELA_APP_PORT)"
fi
APP_URL="http://localhost:$APP_PORT"

# Database: the app reaches it inside Docker, so by default it gets no fixed
# host port — Docker assigns a free one on 127.0.0.1, which cannot collide.
# SELA_DB_PORT asks for a fixed one, for psql or pnpm on this machine.
DB_PORT=$(env_value SELA_DB_PORT)
if [ -n "$DB_PORT" ]; then
  is_port_number "$DB_PORT" || die "SELA_DB_PORT must be a port number, not '$DB_PORT'"
  if [ "$(own_port db 5432)" != "$DB_PORT" ] && ! port_free "127.0.0.1:" "$DB_PORT" 5432; then
    holder=$(port_holder "$DB_PORT")
    die "port $DB_PORT (SELA_DB_PORT) is already in use on this machine${holder:+ ($holder)}.
Change SELA_DB_PORT in .env, or delete that line: sela does not need it. Then
run this again."
  fi
  say "database port: 127.0.0.1:$DB_PORT (SELA_DB_PORT)"
else
  say "database port: none fixed (sela does not need one; set SELA_DB_PORT for psql/pnpm)"
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
