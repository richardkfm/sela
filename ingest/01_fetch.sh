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
#   5  the transfer itself failed (connection reset, a WFS response cut off
#      mid-transfer) after retries; whatever was on disk before is untouched
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
  BLOCKED_BY=$(q '.sources[$id].blockedBy // .sources[$id].note // empty')
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
  # --retry-all-errors: a connection reset (curl 35) is the common failure
  # through a proxy, and plain --retry does not retry it.
  head_out=$(curl -fsSIL --retry 4 --retry-all-errors --retry-delay 2 --max-time 120 "$url") \
    || { echo "HEAD $url failed; nothing written." >&2; exit 5; }
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
    curl -fsSL --retry 4 --retry-all-errors --retry-delay 2 --max-time 1800 -o "$dest.part" "$url" \
      || { rm -f "$dest.part"; echo "Download of $url failed; previous file left in place." >&2; exit 5; }
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
    PINNED_MD5=$(q '.sources[$id].fetch.publisherMd5 // empty')
    fetch_one "$URL" "$OUT_DIR/$NAME" "$PINNED"
    # Some hosts answer from several backends whose Last-Modified differs for the
    # same file (BKG's DGM200 alternates between two, 2026-09-23). Where the
    # publisher ships a checksum, that is the stronger pin and replaces the date.
    if [ -n "$PINNED_MD5" ]; then
      GOT_MD5=$(md5sum "$OUT_DIR/$NAME" | cut -d' ' -f1)
      if [ "$GOT_MD5" != "$PINNED_MD5" ]; then
        echo "PIN MISMATCH: manifest pins publisher md5 '$PINNED_MD5', file has '$GOT_MD5'." >&2
        exit 4
      fi
      echo "  publisher md5 matches"
    fi
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
  wfs)
    # A WFS is a service, not a file: there is no byte count to pin. What is
    # pinned instead is *what was asked for* — endpoint, layer names and the
    # bounding box, all in the manifest — and what came back is recorded per
    # layer (feature count, sha256 of the written GeoPackage). A re-fetch that
    # returns different data therefore shows up as a provenance diff rather
    # than passing silently. Layers are fetched in the service's own CRS and
    # reprojected later by 02_reproject.sh like any other vector source.
    ENDPOINT=$(q '.sources[$id].fetch.endpoint')
    BBOX=$(q '.sources[$id].fetch.bbox4326 | map(tostring) | join(" ")')
    q '.sources[$id].fetch.layers[]' > "$OUT_DIR/.layers.tmp"
    while IFS= read -r layer; do
      [ -n "$layer" ] || continue
      name=$(printf '%s' "$layer" | tr ':' '_')
      dest="$OUT_DIR/$name.gpkg"
      part="$OUT_DIR/.$name.part.gpkg"
      echo "  fetching WFS layer $layer"
      # Written to a temporary file and moved into place only once it opens:
      # a GetFeature response cut off mid-transfer makes ogr2ogr stop with a
      # half-written GeoPackage, and deleting the good copy first would leave
      # the load step nothing but that (seen 2026-09-23 on app:ffh).
      ok=0
      for attempt in 1 2 3; do
        rm -f "$part"
        # shellcheck disable=SC2086
        if ogr2ogr -f GPKG "$part" "WFS:$ENDPOINT" "$layer" -spat $BBOX -spat_srs EPSG:4326 -nlt PROMOTE_TO_MULTI -forceNullable \
          && ogrinfo -ro -so "$part" >/dev/null 2>&1; then
          ok=1
          break
        fi
        echo "  $layer: attempt $attempt failed" >&2
        sleep $((attempt * 4))
      done
      if [ "$ok" -ne 1 ]; then
        rm -f "$part" "$RECORDS" "$OUT_DIR/.layers.tmp"
        echo "WFS layer $layer could not be fetched after 3 attempts; previous files left in place." >&2
        exit 5
      fi
      mv -f "$part" "$dest"
      count=$(ogrinfo -ro -so -al "$dest" 2>/dev/null | sed -n 's/^Feature Count: //p' | awk '{s+=$1} END{print s+0}')
      sha=$(sha256sum "$dest" | cut -d' ' -f1)
      jq -n --arg f "$(basename "$dest")" --arg u "$ENDPOINT" --arg l "$layer" \
            --argjson c "${count:-0}" --argjson b "$(wc -c < "$dest" | tr -d ' ')" --arg s "$sha" \
            '{file:$f,url:$u,layer:$l,featureCount:$c,bytes:$b,sha256:$s}' >> "$RECORDS"
    done < "$OUT_DIR/.layers.tmp"
    rm -f "$OUT_DIR/.layers.tmp"
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
