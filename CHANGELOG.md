# Changelog

All notable changes to sela are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with the version ladder described below.

---

## Versioning approach

Pre-1.0 versions carry meaning in this project. The minor version states which layer of the project is being built; the patch version tracks increments within it.

| Band | Meaning | Done when |
|---|---|---|
| `0.1.x` | **Planning and documentation** — mission, scope, product principles, design language, open questions | The MVP is defined well enough that domain modelling can start without re-litigating scope |
| `0.2.x` | **Domain model and architecture** — glossary, scenario semantics, scoring criteria, data inventory, ADRs | The spatial unit, data sources, and system shape are decided and recorded |
| `0.3.x` | **MVP foundations** — data ingestion for a pilot region, scoring prototype, first UI | A real parcel can be compared across all four scenarios, end to end |
| `1.0.0` | **First stable public MVP** — published method, disclaimers, shareable outputs, performance | It can be handed to a municipality and to the public without a caveat about readiness |

Breaking changes to public interfaces, scoring semantics, or data contracts are called out under `### Changed` with a `**BREAKING:**` prefix, in every band including pre-1.0.

---

## [Unreleased]

---

## [0.2.0] - 2026-08-22

Phase 1 of the roadmap: the decisions of record are written as ADRs, and a Docker-deployable
application skeleton exists. No pilot-region data, scoring, or map rendering yet — that is
`0.2.1` and `0.3.0`.

### Added

- **`docs/architecture/adr-0001-spatial-unit.md`** — generated 100 m hex grid via PostGIS `ST_HexagonGrid`, behind a `spatial_unit.kind` abstraction so ALKIS *Flurstück* is a later addition, not a rewrite. States what is given up: a grid cell is not what a municipality names in a council session. Closes **U1**.
- **`docs/architecture/adr-0002-geodata-stack.md`** — Next.js (App Router, TypeScript) + PostGIS + MapLibre GL, with the binding rule that TypeScript never computes geometry or raster math; a separate `ingest` container owns GDAL and PostGIS SQL.
- **`docs/architecture/adr-0003-basemap.md`** — self-hosted PMTiles from OSM via Geofabrik, styled desaturated in-repo, fonts and sprites self-hosted rather than CDN-fetched. Records the standing ODbL attribution duty on every screen and export. Closes **U8**.
- **`docs/domain/glossary.md`** — DE/EN vocabulary for spatial units, scenarios, technologies, criteria, and provenance terms, each tied to the identifier it maps to in schema, code, or UI.
- **`docs/data/sources.md`** — the licence gate on Phase 2 ingestion. Four candidate datasets recorded with licence position; three carried forward as previously assessed, one (DWD CDC radiation grids) explicitly marked unconfirmed and blocking until its terms are read in full.
- **Application skeleton** — Next.js App Router project (`app/`, `lib/`) with a map-explorer route, a `/method` placeholder, and a `/api/health` liveness check; `lib/design/tokens.ts` and `app/globals.css` implementing the `design-language.md` §4.2 semantic palette (both light and dark, with each scenario's required secondary encoding) as tokens rather than raw hex; `lib/db/migrate.ts`, a minimal SQL migration runner, plus one migration enabling the `postgis` extension; `lib/scoring/` and `ingest/` left as documented placeholders for `0.2.1`.
- **Docker** — `docker/Dockerfile` (multi-stage, `next.config` `output: 'standalone'`), `docker/Dockerfile.ingest` (GDAL-based placeholder), `compose.yaml` wiring `app` · `db` (`postgis/postgis:16-3.4`) · a `migrate` step · `ingest` (profile-gated). `.env.example`, `.dockerignore`.

### Changed

- **`README.md`** — status moved to `0.2.0`; repository layout and a "Running it" section reflect what now exists.

### Verification

- `pnpm install`, `pnpm typecheck`, and `pnpm build` all pass; the built `standalone` server was run directly and `/`, `/method`, and `/api/health` were confirmed to respond.
- `docker compose up` itself was **not** run — this development environment has no Docker daemon available. The Dockerfile stages mirror the locally-verified build exactly (same `pnpm install` / `pnpm build` / standalone output), but the container path should be confirmed on a machine with Docker before this is treated as proven end to end.
- The migration script was verified by typecheck only; no local Postgres/PostGIS server was available to run it against.

### Notes

- This closes **U1** and **U8**. `docs/product/mvp.md` §10's `0.2.0` bar — spatial unit as an ADR, a data-source inventory with licence per dataset, and scenarios specified precisely enough to implement — is met for the spatial unit and the inventory; the criteria catalogue (`docs/domain/scoring-criteria.md`) is still open and is the natural next document.
- **U4** (constraints as filters vs. penalties) is deliberately not decided here — the roadmap places it in Phase 2 as ADR-0004, once real criterion data exists to reason about.

---

## [0.1.0] - 2026-08-21

Initial project setup. Establishes the mission, the working agreement, the MVP definition, and the visual standard. Planning artefacts only — no implementation, and no technology stack chosen.

### Added

- **`CLAUDE.md`** — working agreement for Claude Code: sela's mission, the mandatory planning-first workflow (restate → assumptions → unknowns → phased plan → affected files → risks → confirm), the confirmation gate covering architecture, scoring, scope, user-visible behaviour, data/licensing, and visual language, and the six product principles stated as checkable constraints.
- **`.claude/settings.json`** — project settings with `permissions.defaultMode` set to `plan`, so sessions start in plan mode by default.
- **`README.md`** — project vision, problem statement, the four target user groups and the question each arrives with, MVP scope and non-goals, core principles, design register, repository layout, next planning documents, versioning approach, and advisory-use disclaimer.
- **`CHANGELOG.md`** — this file; initialises versioning at `0.1.0` and defines the version ladder.
- **`docs/product/mvp.md`** — MVP definition: objective, target users, non-goals, the three technologies and the criteria driving each, the four scenarios and their output shapes, first user flows, first screens, core data and scoring concepts (criterion record, outcome dimensions, the no-hidden-composites rule), nine recorded open questions, and demonstrable success criteria for v0.1 / v0.2 / v0.3.
- **`docs/product/design-language.md`** — visual standard: the editorial-cartographic register, named anti-patterns, semantic colour system with colourblind and greyscale-print constraints, typography, map styling rules, the shareable scenario card format, the confidence and uncertainty vocabulary, and the WCAG 2.2 AA / BITV 2.0 accessibility floor.
- **`.gitignore`** — OS, editor, environment, Python, and Node exclusions, plus geodata artefacts (`*.gpkg`, `*.tif`, `*.parquet`, `data/raw/`, and similar), which are referenced by source and licence in documentation rather than committed.

### Notes

- Nine open questions are recorded rather than assumed. The most consequential are the choice of spatial unit (ALKIS *Flurstück* vs. a generated grid), whether grid-connection capacity is in MVP scope, and per-source data licensing — each is capable of reshaping the data model or blocking public release.
- No LICENSE, contribution guide, CI configuration, or dependency manifest yet; these follow once the stack is chosen in the `0.2.x` band.

[Unreleased]: https://github.com/richardkfm/sela/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/richardkfm/sela/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/richardkfm/sela/releases/tag/v0.1.0
