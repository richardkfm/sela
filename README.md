# sela

**Spatial decision-support for land-use trade-offs — comparing what is built, what is preserved, and what is restored.**

> **Status: `0.3.x` — first real pilot region, illustrative weights.** The map explorer shows the **Landkreis Uckermark** (Brandenburg) as 117 191 hex cells, each with **real measured values** — land cover (BKG CLC5), slope (BKG DGM200), irradiation (DWD, 2016–2025 mean) and protected areas (LfU Brandenburg) — scored with an **explicitly arbitrary illustrative weighting**. The values are real; the weights, thresholds and therefore the verdicts are placeholders, and every screen says so. Every weight in [`docs/domain/scoring-criteria.md`](docs/domain/scoring-criteria.md) is still open pending the `CLAUDE.md` §3 confirmation gate; outcomes for *preserve* and *restore* are not yet modelled for real land. The synthetic fixture remains available at `/?region=fixture-region`. See [`CHANGELOG.md`](CHANGELOG.md) `[Unreleased]`.

---

## Screenshots

The first five screenshots show the real Uckermark: real measured values, **illustrative weights** — the verdict colours are not a siting statement. The rows below them were rendered against the synthetic fixture, which sits at 0° N 0° E on purpose, so its 3D preview shows flat ground without a basemap.

| Uckermark — the whole Landkreis | Uckermark — a unit selected |
|---|---|
| [![Uckermark explorer](docs/product/screenshots/uckermark-explorer.png)](docs/product/screenshots/uckermark-explorer.png) | [![Uckermark, unit selected](docs/product/screenshots/uckermark-selection.png)](docs/product/screenshots/uckermark-selection.png) |

| Uckermark — measured values of one unit | Uckermark — the source behind a criterion |
|---|---|
| [![Uckermark unit detail](docs/product/screenshots/uckermark-unit.png)](docs/product/screenshots/uckermark-unit.png) | [![Uckermark evidence view](docs/product/screenshots/uckermark-evidence.png)](docs/product/screenshots/uckermark-evidence.png) |

| Uckermark — 3D preview on the DGM5 relief, reference turbine at true scale |
|---|
| [![Uckermark 3D preview](docs/product/screenshots/uckermark-preview.png)](docs/product/screenshots/uckermark-preview.png) |

| Map explorer — fixture | Map explorer — fixture, a unit selected |
|---|---|
| [![Map explorer](docs/product/screenshots/map-explorer.png)](docs/product/screenshots/map-explorer.png) | [![Map explorer with selection](docs/product/screenshots/map-explorer-selection.png)](docs/product/screenshots/map-explorer-selection.png) |

| 3D preview — reference turbine at true scale | 3D preview — cited setback rings |
|---|---|
| [![3D preview, wind](docs/product/screenshots/preview-wind.png)](docs/product/screenshots/preview-wind.png) | [![3D preview, rings](docs/product/screenshots/preview-wind-rings.png)](docs/product/screenshots/preview-wind-rings.png) |

| 3D preview — from eye height, 1 000 m away | 3D preview — Agri-PV rows on supports |
|---|---|
| [![3D preview, eye level](docs/product/screenshots/preview-wind-eye-level.png)](docs/product/screenshots/preview-wind-eye-level.png) | [![3D preview, Agri-PV](docs/product/screenshots/preview-agripv.png)](docs/product/screenshots/preview-agripv.png) |

| Parcel detail | Scenario comparison |
|---|---|
| [![Parcel detail](docs/product/screenshots/parcel-detail.png)](docs/product/screenshots/parcel-detail.png) | [![Scenario comparison](docs/product/screenshots/scenario-comparison.png)](docs/product/screenshots/scenario-comparison.png) |

| Evidence view | Method page |
|---|---|
| [![Evidence view](docs/product/screenshots/evidence-view.png)](docs/product/screenshots/evidence-view.png) | [![Method page](docs/product/screenshots/method.png)](docs/product/screenshots/method.png) |

---

## Vision

Decisions about land are made once and felt for decades. A field can carry a solar park, a wind turbine, a wildflower meadow, a restored peatland, or the crop rotation it carries today — and each of those futures produces a different set of gains and losses for climate, biodiversity, soil, water, and the local budget.

Today those futures are assessed by different people, in different tools, using different units, and are never placed side by side. sela puts them side by side, on the same parcel, with the evidence visible.

sela is not a recommendation engine. It is an instrument for making a trade-off legible enough that people with opposing interests can argue about the same facts.

## The problem

- **Suitability tools answer only one question.** Solar cadastres show where PV fits. Conservation maps show what is protected. Neither tells you what you give up by choosing the other.
- **Scores arrive without reasons.** A parcel rated "0.78 suitable" is not an argument a council can defend in public, and not a claim a citizen can challenge.
- **Nature capital is treated as absence.** What a landscape already delivers — carbon in the soil, water retention, habitat continuity — is usually modelled as "not yet developed" rather than as value worth counting.
- **The evidence is not public.** Data that decides land use in Germany is scattered across federal, state, and municipal sources, with mixed licensing and no shared interface.

## Who it is for

| User | The question they arrive with | What they need to see |
|---|---|---|
| **Municipalities** | Where should we steer development — and what can we defend in a council session? | Comparable options across the municipal area, with the reasoning citable in a public document |
| **Investors** | Which sites are viable, and what is the risk of conflict? | Suitability with the constraints and objections that drive it, stated early |
| **Project developers** | Which parcels are worth pursuing first? | Ranked candidates with the specific criterion that limits each one |
| **The public** | Why this field, and what happens to it? | A plain-language answer with the evidence and its uncertainty visible |

## MVP scope

**Geography:** Germany-first.

**Technologies:** ground-mounted solar PV · agrivoltaics · onshore wind.

**Scenarios:** `status quo` · `develop` · `preserve` · `restore` — always compared, never shown alone.

**Product goal:** explainable parcel comparison. Every headline number decomposes into named criteria with sources, weights, and confidence.

**Not in the MVP:** permitting workflows, financial modelling (LCOE, yield forecasts as investment advice), live grid data, geographies outside Germany, ownership data, or any output implying planning permission. The full list is in [`docs/product/mvp.md`](docs/product/mvp.md).

## Core principles

1. **Public explainability** — every number traces to named, cited criteria. No opaque composites.
2. **Scenario comparison** — outcomes are shown against alternatives, never in isolation.
3. **Nature capital** — preservation and restoration are quantified outcomes, not the absence of development.
4. **Multi-stakeholder design** — the same evidence, legible to a planner, an investor, and a neighbour.
5. **Transparent trade-offs** — what is gained, what is given up, under which assumptions, with what confidence.
6. **Credible by design** — it must look like a serious data publication, because it will be projected, screenshotted, and shared.

## Design and identity

sela's visual register is **editorial cartographic** — closer to a newspaper graphics desk than to a GIS application. A muted basemap, so data carries all the colour. Strong typographic hierarchy, tabular figures, generous whitespace. Scenario colours are semantic and fixed, validated for colour-vision deficiency, and always paired with a pattern — because council packets get printed in black and white, where hue alone collapses.

Explicitly excluded: grey desktop-GIS chrome, and the neon-gradient register of crypto dashboards. Accessibility (WCAG 2.2 AA, relevant to BITV 2.0 for public-sector-facing tools) is a floor, not a finishing task.

The full standard, including the shareable scenario card format: [`docs/product/design-language.md`](docs/product/design-language.md).

## Repository layout

```
CLAUDE.md                        Working agreement for Claude Code
CHANGELOG.md                     Version history and version ladder
.claude/settings.json            Plan mode by default
docs/product/mvp.md              MVP definition — scope, flows, screens, success criteria
docs/product/design-language.md  Visual standard and shareability format
docs/architecture/               ADRs and system design
  roadmap-to-first-deployment.md Route from planning documents to a deployable web app
  adr-0001-spatial-unit.md       Generated hex grid, not ALKIS Flurstück — closes U1
  adr-0002-geodata-stack.md      Next.js + PostGIS + MapLibre, and the TypeScript/GDAL boundary
  adr-0003-basemap.md            Self-hosted PMTiles from OSM — closes U8
  adr-0004-constraints-as-filters.md  Hard constraints exclude rather than penalize — closes U4
  adr-0005-osm-free-stack.md     OpenStreetMap out of the stack; basemap.de — closes U7
  adr-0006-3d-parcel-preview.md  2D explorer + a literal-3D parcel preview (deck.gl over MapLibre)
  adr-0007-unit-vector-tiles.md  Units served as vector tiles cut by PostGIS (ST_AsMVT)
docs/domain/glossary.md          DE/EN vocabulary
docs/domain/scoring-criteria.md  Criteria catalogue per technology — weights deliberately left open
docs/data/sources.md             Dataset inventory and verification log — the licence gate on real ingestion
app/                             Next.js App Router — map explorer, parcel detail, scenario
                                  comparison, evidence view, method page, 3D parcel preview,
                                  tile/style routes, scenario-card export
components/                      Shared UI: ScenarioBadge, IllustrativeBanner, ConfidenceMark,
                                  NotModelledBadge
lib/design/tokens.ts             Semantic design tokens (design-language.md §4.2)
lib/db/                          Migration runner, SQL migrations (domain schema in 0002), and the
                                  request-time query layer (lib/db/queries/)
lib/scoring/                     Pure scoring engine — suitability, outcomes, deltas; unit-tested.
                                  illustrative-weights.ts is Phase 3 demo-only input, not real weights
lib/basemap/                     Basemap and terrain sources (basemap.de, DGM5 terrain), PMTiles reader
lib/map/                         Verdict colours + map patterns, shared by explorer, legend and preview
lib/preview/                     3D preview: reference dimensions, cited rings, procedural meshes
ingest/                          GDAL + SQL pipeline, gated on sources.md; real/ ingests the
                                  Uckermark end to end; fixtures/ proves the mechanics;
                                  basemap/ builds the self-hosted PMTiles archive;
                                  07_materialize_scores.ts bridges criterion values to scored rows
tests/e2e/                       Playwright: WCAG 2.2 AA, keyboard-only navigation, greyscale
docker/                          Dockerfile (app + basemap build stage) and Dockerfile.ingest
compose.yaml                     app · db (PostGIS) · ingest (profile) · materialize (profile)
```

## Running it

```
cp .env.example .env
docker compose up                                   # app on :3000, PostGIS on :5432, migrations applied automatically
docker compose --profile ingest run ingest -- --fixture   # synthetic data, proves the pipeline
docker compose --profile ingest run materialize      # populates suitability_verdict/outcome from it
docker compose down -v                               # tear down, including the database volume

pnpm install
pnpm test                  # lib/scoring/ unit + integration tests
DATABASE_URL=postgresql://sela:sela@localhost:5432/sela pnpm db:migrate
DATABASE_URL=postgresql://sela:sela@localhost:5432/sela ./ingest/run.sh --fixture     # synthetic data
DATABASE_URL=postgresql://sela:sela@localhost:5432/sela pnpm db:materialize          # score it
DATABASE_URL=postgresql://sela:sela@localhost:5432/sela ./ingest/run.sh               # real Uckermark (≈ 1 GB download; needs GDAL, raster2pgsql)
DATABASE_URL=postgresql://sela:sela@localhost:5432/sela pnpm db:materialize -- --pilot-region=uckermark-12073
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e   # against a running `pnpm dev`
```

The explorer opens on the Uckermark once it has been ingested, and on the synthetic fixture
otherwise (`SELA_PILOT_REGION`, `/?region=`). Both are scored with an explicitly arbitrary
illustrative weighting (`lib/scoring/illustrative-weights.ts`) — never real scoring weights. Each
dataset enters ingestion only once `docs/data/sources.md` records it as Confirmed, and real
scoring weights are gated on the `CLAUDE.md` §3 confirmation process against
`docs/domain/scoring-criteria.md`. The self-hosted PMTiles basemap
(`ingest/basemap/build.sh`) is built from a small real OSM extract chosen only for build
tractability, not the (still unpinned) real pilot region — see `ingest/basemap/README.md`.

## Next planning documents

| Document | Purpose | Band |
|---|---|---|
| `docs/data/sources.md` | Closing the licence gate for the remaining datasets (BfN, a wind resource, soil) | `0.2.x`, ongoing |
| `docs/domain/scoring-criteria.md` | Setting real weights per technology through the `CLAUDE.md` §3 confirmation gate | `0.2.x`, ongoing |

## Versioning

Semantic Versioning, with meaning attached to the early bands:

| Band | Meaning |
|---|---|
| `0.1.x` | Planning and documentation |
| `0.2.x` | Domain model and architecture |
| `0.3.x` | MVP foundations — data, scoring, first UI |
| `1.0.0` | First stable public MVP |

See [`CHANGELOG.md`](CHANGELOG.md).

## Disclaimer

sela is an advisory instrument. Its outputs support discussion and pre-assessment; they do not constitute a planning permission, an environmental impact assessment, or investment advice.
