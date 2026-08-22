# sela

**Spatial decision-support for land-use trade-offs — comparing what is built, what is preserved, and what is restored.**

> **Status: `0.1.0` — planning, moving to `0.2.x`.** This repository currently contains planning documents only. Implementation has not begun, but the stack and the route to a first deployment are now decided — see [`docs/architecture/roadmap-to-first-deployment.md`](docs/architecture/roadmap-to-first-deployment.md).

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
```

Directories for `docs/domain/`, `docs/data/`, and application code are created when their phase begins.

## Next planning documents

| Document | Purpose | Band |
|---|---|---|
| `docs/domain/glossary.md` | Shared vocabulary — parcel, scenario, criterion, outcome, in DE and EN | `0.1.x` |
| `docs/data/sources.md` | Dataset inventory: coverage, licence, resolution, update cadence, redistributability | `0.1.x` |
| `docs/domain/scoring-criteria.md` | Criteria catalogue per technology, with direction, weight rationale, and citation | `0.2.x` |
| `docs/architecture/adr-0001-spatial-unit.md` | ALKIS *Flurstück* vs. generated grid — the decision everything else depends on | `0.2.x` |
| `docs/architecture/adr-0002-geodata-stack.md` | Storage, processing, and tile serving | `0.2.x` |

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
