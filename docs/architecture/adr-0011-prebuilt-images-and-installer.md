# ADR-0011 — Prebuilt images on GHCR and a Docker installer

**Status:** Accepted — options chosen by the owner on 2026-09-28 · **Band:** `0.3.x` ·
**Date:** 2026-09-28 · **Amends:** `compose.yaml`, `docker/Dockerfile`; adds
`.github/workflows/publish-images.yml`, `scripts/install.sh`

---

## Context

Running sela meant building three images from source (`compose.yaml`): the app, the `builder`
stage for migrations and materialisation, and the GDAL ingest image. That is several minutes of
build and a Node/Java/GDAL download before anything is on screen. The owner asked for a Docker
installer so sela can be installed with one command, and chose prebuilt images over a script that
only wraps the source build.

Publishing an image is distributing its contents, so what goes into the image is a licensing
question as much as a build question (`CLAUDE.md` §3, data sources and licensing).

## Decision

1. **Three images on GitHub Container Registry**, published by
   `.github/workflows/publish-images.yml`, one per image name in `compose.yaml`:

   | Image | Built from | Used by |
   |---|---|---|
   | `ghcr.io/richardkfm/sela` | `docker/Dockerfile`, target `runner` | `app` |
   | `ghcr.io/richardkfm/sela-tools` | `docker/Dockerfile`, target `builder` | `migrate`, `materialize` |
   | `ghcr.io/richardkfm/sela-ingest` | `docker/Dockerfile.ingest` | `ingest` |

2. **Tags:** every push to `main` publishes `:latest`; a tag `vX.Y.Z` publishes `:X.Y.Z` and
   `:X.Y`; every build also publishes `:sha-<short>`. `SELA_VERSION` selects the tag in
   `compose.yaml` (default `latest`). Pull requests that change `docker/`, `compose.yaml` or the
   workflow build all three images without pushing them.
3. **`linux/amd64` only.** arm64 machines (Apple Silicon) run the images under emulation;
   `scripts/install.sh` sets `DOCKER_DEFAULT_PLATFORM=linux/amd64` there. Revisit if emulation
   proves too slow for demos.
4. **No OSM data in a published image.** `docker/Dockerfile` takes `WITH_BASEMAP` (default `true`
   for local builds, unchanged); the workflow builds with `WITH_BASEMAP=false`, so the published
   app image carries no OSM-derived PMTiles archive (ODbL). ADR-0005 already made basemap.de the
   basemap and `SELA_BASEMAP=auto` never reads the archive, so the published image loses nothing
   it would have shown.
5. **No fetched data in any image.** The ingest image holds the `ingest/` directory as committed
   — its scripts, the synthetic fixtures, and the VG25-derived pilot boundary
   (`ingest/pilot/`, CC BY 4.0, attribution in `ingest/pilot/README.md`) that the public
   repository already publishes. Every dataset is fetched on the user's machine by
   `ingest/01_fetch.sh`, under the licence gate in `docs/data/sources.md`.
6. **One `compose.yaml` for both routes.** Each sela service names its `image` and keeps its
   `build`. The installer runs `docker compose pull` and `up --no-build`; from a checkout,
   `docker compose up --build` builds from source.
7. **The installer is a script in the repository**, run from a clone (`scripts/install.sh`), not
   piped from the network. It asks which data to load — the synthetic fixture, the real
   Uckermark, or none — before any long step; `--data` answers without asking and `--build`
   builds from the checkout instead of pulling.

## Consequences

- **The packages must be public once.** GHCR packages created by a workflow may start private;
  the owner then sets each of the three to public in the package settings. Until then (or
  without access to `ghcr.io`) the installer stops with a message pointing to `--build`.
- **Publishing is not gated on tests.** The image workflow runs on every push to `main`
  alongside CI, not after it; a commit that breaks CI is still published as `:latest` until the
  next push. Tagged releases are the stable target (`SELA_VERSION`).
- **Plain `docker compose up` is ambiguous in a checkout** that has pulled images: it may start
  the pulled image rather than the working tree. The README and `compose.yaml` say to use
  `--build` for source.
- **Apple Silicon is slower** under emulation (decision 3).
- **The `builder` image is large** — it carries all dependencies, including the development
  ones, because migrations and materialisation run through `tsx`. Acceptable for a local demo;
  a slimmer tools image is future work if download size matters.
