// Phase 3 (0.3.0) is fixture-first (CHANGELOG.md [0.3.0], confirmed with
// the project owner) — every screen renders the synthetic
// ingest/fixtures/ dataset under this pilot_region until real ingestion
// closes docs/data/sources.md's licence gate.
export const DEFAULT_PILOT_REGION = "fixture-region";

/**
 * Which legal regimes a pilot region's units fall under — used by the 3D
 * preview (ADR-0006) to decide which cited setback rings apply. Stated per
 * region rather than derived per unit because no *Bundesland* boundary is
 * loaded yet; a region that straddles a state border would need that.
 *
 * `fixture-region` sits at null island and belongs to no jurisdiction. Its
 * rings are drawn *as if* it lay in the real pilot region, and the preview
 * says so in words — the synthetic data needs something to demonstrate
 * against, and pretending the rings do not exist would hide the feature.
 */
export const PILOT_REGION_JURISDICTIONS: Record<
  string,
  { readonly jurisdictions: readonly ("DE" | "DE-BB")[]; readonly asIfIn?: string }
> = {
  "fixture-region": { jurisdictions: ["DE", "DE-BB"], asIfIn: "Landkreis Uckermark (Brandenburg)" },
  // The real Uckermark region gets its entry in the same change that first
  // ingests it under a pilot_region id — none is assigned yet, and a guessed
  // id here would silently never match. Unknown regions get no rings.
};
