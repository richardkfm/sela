#!/bin/sh
set -eu
# Step 2 (roadmap §4.2): reproject with GDAL to the storage CRS
# (EPSG:25832, ADR-0001). Usage: 02_reproject.sh <input> <output>
#
# Vector formats go through ogr2ogr; anything ogr2ogr rejects as not a
# vector source falls back to gdalwarp for rasters. Overwrites the output
# each run, which is what makes this step idempotent.

INPUT="${1:?usage: 02_reproject.sh <input> <output>}"
OUTPUT="${2:?usage: 02_reproject.sh <input> <output>}"
TARGET_SRS="EPSG:25832"

if ogr2ogr -t_srs "$TARGET_SRS" -overwrite "$OUTPUT" "$INPUT" 2>/dev/null; then
  echo "reprojected (vector): $INPUT -> $OUTPUT"
else
  gdalwarp -t_srs "$TARGET_SRS" -overwrite "$INPUT" "$OUTPUT"
  echo "reprojected (raster): $INPUT -> $OUTPUT"
fi
