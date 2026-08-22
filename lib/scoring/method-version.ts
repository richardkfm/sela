// Bump this whenever suitability.ts or outcomes.ts change in a way that
// would produce a different verdict or outcome for the same criterion
// values. Every row lib/scoring/ produces carries this string, so the
// method page (Phase 3, roadmap §5.1) — rendered from the same
// criterion_definition rows the scoring reads — can never silently drift
// from the code that produced a score.
export const CURRENT_METHOD_VERSION = "0.2.1-dev";
