#!/bin/sh
set -eu
# Step 1 (roadmap §4.2): fetch, kept separate from load so the pipeline can
# re-run offline. Usage: 01_fetch.sh <source_id>
#
# Refuses to fetch anything whose docs/data/sources.md status is not
# "confirmed" in ingest/sources.manifest.json — the machine-checked half of
# the roadmap §2.2 gate (`CLAUDE.md` §5: no licence may be asserted without
# verification). No network call happens for an unconfirmed source.

SOURCE_ID="${1:?usage: 01_fetch.sh <source_id>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$SCRIPT_DIR/sources.manifest.json"

STATUS=$(jq -r --arg id "$SOURCE_ID" '.sources[$id].status // "unknown"' "$MANIFEST")

if [ "$STATUS" = "unknown" ]; then
  echo "Unknown source id: '$SOURCE_ID' (not in $MANIFEST)." >&2
  exit 2
fi

if [ "$STATUS" != "confirmed" ]; then
  echo "BLOCKED: source '$SOURCE_ID' is not confirmed (status: $STATUS)." >&2
  echo "See docs/data/sources.md and ingest/sources.manifest.json. Ingestion" >&2
  echo "of this dataset may not start until its licence position reads" >&2
  echo "Confirmed (docs/architecture/roadmap-to-first-deployment.md §2.2)." >&2
  exit 1
fi

# A confirmed source still needs its actual fetch command written — that is
# real, source-specific work (a WFS GetFeature request, a Geofabrik
# download URL, ...) deliberately not stubbed out here in advance of any
# source actually reaching Confirmed, so this never silently no-ops.
echo "'$SOURCE_ID' is confirmed, but its fetch command is not yet implemented." >&2
echo "Add the real fetch step for this source in 01_fetch.sh once you reach" >&2
echo "this point — confirming a licence is necessary but not sufficient." >&2
exit 1
