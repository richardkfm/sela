#!/bin/sh
set -eu
# Step 1 (roadmap §4.2): fetch, kept separate from load so the pipeline can
# re-run offline. Usage: 01_fetch.sh <source_id>
#
# Refuses to fetch anything whose docs/data/sources.md status is not
# "confirmed" in ingest/sources.manifest.json — the machine-checked half of
# the roadmap §2.2 gate (`CLAUDE.md` §5: no licence may be asserted without
# verification). No network call happens for an unconfirmed source.
#
# Exit codes (run.sh depends on these being distinct):
#   0  fetched, or already present and verified
#   1  blocked by the licence gate — status is not "confirmed"
#   2  unknown source id
#   3  confirmed, but no fetch is implemented for it yet
#   4  the artefact the server returned does not match the pinned one
#
# Output goes to $DATA_DIR/<source_id>/ (default data/raw/, git-ignored).
# Every run writes fetch-provenance.json next to the files: retrieval time,
# URL, byte count, upstream Last-Modified and sha256 of each artefact. That
# file is what lets a later session verify a claim in docs/data/sources.md
# instead of taking it on trust.

SOURCE_ID="${1:?usage: 01_fetch.sh <source_id>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/sources.manifest.json"
DATA_DIR="${DATA_DIR:-$REPO_ROOT/data/raw}"

q() { jq -r --arg id "$SOURCE_ID" "$1" "$MANIFEST"; }

STATUS=$(q '.sources[$id].status // "unknown"')

if [ "$STATUS" = "unknown" ]; then
  echo "Unknown source id: '$SOURCE_ID' (not in $MANIFEST)." >&2
  exit 2
fi

if [ "$STATUS" != "confirmed" ]; then
  echo "BLOCKED: source '$SOURCE_ID' is not confirmed (status: $STATUS)." >&2
  BLOCKED_BY=$(q '.sources[$id].blockedBy // empty')
  [ -n "$BLOCKED_BY" ] && echo "  reason: $BLOCKED_BY" >&2
  echo "See docs/data/sources.md and ingest/sources.manifest.json. Ingestion" >&2
  echo "of this dataset may not start until its licence position reads" >&2
  echo "Confirmed (docs/architecture/roadmap-to-first-deployment.md §2.2)." >&2
  exit 1
fi

KIND=$(q '.sources[$id].fetch.kind // "none"')
if [ "$KIND" = "none" ]; then
  echo "'$SOURCE_ID' is confirmed, but its fetch command is not yet implemented." >&2
  echo "Add the real fetch step for this source in 01_fetch.sh once you reach" >&2
  echo "this point — confirming a licence is necessary but not sufficient." >&2
  exit 3
fi

OUT_DIR="$DATA_DIR/$SOURCE_ID"
mkdir -p "$OUT_DIR"
PROV="$OUT_DIR/fetch-provenance.json"
RECORDS="$(mktemp)"
trap 'rm -f "$RECORDS"' EXIT
: > "$RECORDS"

# Downloads $1 to $2 unless $2 is already the right size, then appends one
# provenance record. $3, if non-empty, is the byte count the manifest pins.
fetch_one() {
  url="$1"; dest="$2"; pinned_bytes="${3:-}"
  head_out=$(curl -fsSIL --retry 4 --retry-delay 2 --max-time 120 "$url")
  remote_bytes=$(printf '%s\n' "$head_out" | awk 'tolower($1)=="content-length:"{v=$2} END{gsub(/\r/,"",v); print v}')
  remote_mtime=$(printf '%s\n' "$head_out" | sed -n 's/^[Ll]ast-[Mm]odified: //p' | tr -d '\r' | tail -1)

  if [ -n "$pinned_bytes" ] && [ "$remote_bytes" != "$pinned_bytes" ]; then
    echo "PIN MISMATCH for $url" >&2
    echo "  manifest pins $pinned_bytes bytes, server offers $remote_bytes." >&2
    echo "  The upstream artefact has changed. Re-read the row in" >&2
    echo "  docs/data/sources.md and re-pin deliberately; do not ingest silently." >&2
    exit 4
  fi

  if [ -f "$dest" ] && [ "$(wc -c < "$dest" | tr -d ' ')" = "$remote_bytes" ]; then
    echo "  present, size matches: $(basename "$dest")"
  else
    echo "  fetching $(basename "$dest") ($remote_bytes bytes)"
    curl -fsSL --retry 4 --retry-delay 2 --max-time 1800 -o "$dest.part" "$url"
    mv "$dest.part" "$dest"
  fi

  local_bytes=$(wc -c < "$dest" | tr -d ' ')
  sha=$(sha256sum "$dest" | cut -d' ' -f1)
  jq -n --arg f "$(basename "$dest")" --arg u "$url" --arg m "$remote_mtime" \
        --argjson b "$local_bytes" --arg s "$sha" \
        '{file:$f,url:$u,bytes:$b,upstreamLastModified:$m,sha256:$s}' >> "$RECORDS"
}

echo "== fetching '$SOURCE_ID' ($KIND) into $OUT_DIR =="

case "$KIND" in
  single-file)
    URL=$(q '.sources[$id].fetch.url')
    NAME=$(q '.sources[$id].fetch.filename')
    PINNED=$(q '.sources[$id].fetch.pinnedBytes // empty')
    PINNED_MTIME=$(q '.sources[$id].fetch.pinnedLastModified // empty')
    fetch_one "$URL" "$OUT_DIR/$NAME" "$PINNED"
    if [ -n "$PINNED_MTIME" ]; then
      GOT_MTIME=$(jq -r '.upstreamLastModified' "$RECORDS" | tail -1)
      if [ "$GOT_MTIME" != "$PINNED_MTIME" ]; then
        echo "PIN MISMATCH: manifest pins Last-Modified '$PINNED_MTIME', server says '$GOT_MTIME'." >&2
        exit 4
      fi
    fi
    ;;
  annual-series)
    BASE=$(q '.sources[$id].fetch.baseUrl')
    TPL=$(q '.sources[$id].fetch.filenameTemplate')
    FIRST=$(q '.sources[$id].fetch.firstYear')
    LAST=$(q '.sources[$id].fetch.lastYear')
    year="$FIRST"
    while [ "$year" -le "$LAST" ]; do
      name=$(printf '%s' "$TPL" | sed "s/{year}/$year/")
      fetch_one "$BASE$name" "$OUT_DIR/$name" ""
      year=$((year + 1))
    done
    q '.sources[$id].fetch.alsoFetch[]? // empty' | while IFS= read -r extra; do
      [ -n "$extra" ] || continue
      echo "$extra"
    done > "$OUT_DIR/.extras.tmp"
    while IFS= read -r extra; do
      [ -n "$extra" ] || continue
      fetch_one "$BASE$extra" "$OUT_DIR/$extra" ""
    done < "$OUT_DIR/.extras.tmp"
    rm -f "$OUT_DIR/.extras.tmp"
    ;;
  *)
    echo "Unsupported fetch kind '$KIND' for '$SOURCE_ID'." >&2
    exit 3
    ;;
esac

jq -n --arg id "$SOURCE_ID" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --slurpfile a "$RECORDS" \
      '{sourceId:$id, retrievedAt:$at, artefacts:$a}' > "$PROV"

echo "== '$SOURCE_ID': $(jq '.artefacts | length' "$PROV") artefact(s), provenance in $PROV =="
