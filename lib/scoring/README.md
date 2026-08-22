# `lib/scoring/`

Phase 2 (`0.2.1`) scoring engine. Per `docs/architecture/adr-0002-geodata-stack.md`, everything
here is pure TypeScript over already-computed `criterion_value` rows — arithmetic and comparison,
no I/O, no geometry, no raster math.

| File | Contents |
|---|---|
| `types.ts` | Shared types, mirroring `lib/db/migrations/0002_domain_schema.sql` exactly |
| `method-version.ts` | `CURRENT_METHOD_VERSION` — bump whenever scoring logic changes output |
| `suitability.ts` | `computeSuitability` — flow F2 (verdict + limiting criterion) and the ADR-0004 filter path |
| `outcomes.ts` | `computeOutcomeRow` / `computeOutcomeDelta` — the six shared outcome dimensions (`mvp.md` §8.3) and deltas vs. the `status_quo` baseline |
| `__tests__/` | `node --test` coverage: limiting-criterion logic, ADR-0004 exclusion, the `not_modelled` path, and a provenance check |

**Deliberately not here:** real criterion weights, normalization thresholds, and the
suitable/unsuitable cutoff. Those are scoring decisions gated by `CLAUDE.md` §3 and tracked in
`docs/domain/scoring-criteria.md` — this module accepts them as caller-supplied parameters
(`normalize`, `suitabilityThreshold`) rather than embedding invented numbers. Real
`criterion_definition` rows land once that catalogue closes.

See `docs/architecture/roadmap-to-first-deployment.md` §4.3 for what this module is required to
produce and why Phase 2 keeps it headless.
