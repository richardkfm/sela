// Wraps the `pmtiles` package (a reader, not a writer — it ships browser
// and HTTP-fetch sources only) over the archive baked into the image at
// build time (ingest/basemap/build.sh, docker/Dockerfile's `basemap`
// stage). Reading happens locally against the filesystem inside the route
// handler — this is what roadmap §5.2 means by "avoids HTTP Range
// plumbing": the range-read happens here, not via an HTTP Range request
// against a statically-served file.

import { existsSync } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { PMTiles, type RangeResponse, type Source } from "pmtiles";

class NodeFileSource implements Source {
  private readonly handlePromise: Promise<FileHandle>;

  constructor(private readonly path: string) {
    this.handlePromise = open(path, "r");
  }

  getKey(): string {
    return this.path;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const handle = await this.handlePromise;
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead) };
  }
}

let instance: PMTiles | null | undefined;

function archivePath(): string {
  return process.env.PMTILES_PATH ?? "data/basemap/pilot.pmtiles";
}

/**
 * Returns the shared PMTiles reader, or `null` if no archive is present —
 * e.g. `ingest/basemap/build.sh` couldn't reach Geofabrik. Callers must
 * degrade gracefully (app/api/tiles/style.json/route.ts serves a flat
 * ground-colour style with no vector source) rather than treat this as an
 * error; a Docker build with no basemap is a known, logged state, not a
 * broken one.
 */
export function getPmtilesReader(): PMTiles | null {
  if (instance !== undefined) {
    return instance;
  }
  const path = archivePath();
  if (!existsSync(path)) {
    console.warn(`no basemap archive at ${path} — serving without a basemap source`);
    instance = null;
    return instance;
  }
  instance = new PMTiles(new NodeFileSource(path));
  return instance;
}
