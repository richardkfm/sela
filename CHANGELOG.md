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

_No unreleased changes._

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

[Unreleased]: https://github.com/richardkfm/sela/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/richardkfm/sela/releases/tag/v0.1.0
