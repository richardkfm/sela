# sela

**Spatial decision-support for land-use trade-offs — comparing what is built, what is preserved, and what is restored.**

> **Status: `0.3.0` — the deployable web app, fixture-first.** All five MVP screens, a self-hosted PMTiles basemap, and a scenario-card export exist and are demoed against a synthetic fixture dataset with an explicitly arbitrary illustrative weighting — **not** real pilot data or real scoring weights. Every candidate dataset in [`docs/data/sources.md`](docs/data/sources.md) is still below Confirmed licence status, and every weight in [`docs/domain/scoring-criteria.md`](docs/domain/scoring-criteria.md) is still open pending the `CLAUDE.md` §3 confirmation gate. See [`docs/architecture/roadmap-to-first-deployment.md`](docs/architecture/roadmap-to-first-deployment.md) §5's status note and [`CHANGELOG.md`](CHANGELOG.md) `[0.3.0]`.

---

## Screenshots

The five MVP screens, rendered against the synthetic fixture dataset described above — illustrative only, not real pilot data or real scoring weights.

| Map explorer (`develop` suitability) | Parcel detail |
|---|---|
| [![Map explorer](docs/product/screenshots/map-explorer.png)](docs/product/screenshots/map-explorer.png) | [![Parcel detail](docs/product/screenshots/parcel-detail.png)](docs/product/screenshots/parcel-detail.png) |

| Scenario comparison | Evidence view |
|---|---|
| [![Scenario comparison](docs/product/screenshots/scenario-comparison.png)](docs/product/screenshots/scenario-comparison.png) | [![Evidence view](docs/product/screenshots/evidence-view.png)](docs/product/screenshots/evidence-view.png) |

| Method page |
|---|
| [![Method page](docs/product/screenshots/method.png)](docs/product/screenshots/method.png) |

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
docs/domain/glossary.md          DE/EN vocabulary
docs/domain/scoring-criteria.md  Criteria catalogue per technology — weights deliberately left open
docs/data/sources.md             Dataset inventory and verification log — the licence gate on real ingestion
app/                             Next.js App Router — map explorer, parcel detail, scenario
                                  comparison, evidence view, method page, PMTiles tile routes,
                                  scenario-card export
components/                      Shared UI: ScenarioBadge, IllustrativeBanner, ConfidenceMark,
                                  NotModelledBadge
lib/design/tokens.ts             Semantic design tokens (design-language.md §4.2)
lib/db/                          Migration runner, SQL migrations (domain schema in 0002), and the
                                  request-time query layer (lib/db/queries/)
lib/scoring/                     Pure scoring engine — suitability, outcomes, deltas; unit-tested.
                                  illustrative-weights.ts is Phase 3 demo-only input, not real weights
lib/basemap/                     PMTiles archive reader for the tile routes
ingest/                          GDAL + SQL pipeline — real mechanics, gated on sources.md,
                                  fixture-proven; basemap/ builds the self-hosted PMTiles archive;
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
PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm test:e2e   # against a running `pnpm dev`
```

Every screen and export currently renders the synthetic fixture dataset above with an explicitly
arbitrary illustrative weighting (`lib/scoring/illustrative-weights.ts`) — never real pilot data or
real scoring weights. Real ingestion is gated on `docs/data/sources.md` reaching Confirmed licence
status per dataset, and real scoring weights are gated on the `CLAUDE.md` §3 confirmation process
against `docs/domain/scoring-criteria.md`. The self-hosted PMTiles basemap
(`ingest/basemap/build.sh`) is built from a small real OSM extract chosen only for build
tractability, not the (still unpinned) real pilot region — see `ingest/basemap/README.md`.

## Next planning documents

| Document | Purpose | Band |
|---|---|---|
| `docs/data/sources.md` | Closing the licence gate per dataset so real ingestion can start | `0.2.x`, ongoing |
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
