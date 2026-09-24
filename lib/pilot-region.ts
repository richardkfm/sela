// The pilot regions sela knows about, and what each one is.
//
// Two kinds, and the difference is the most important thing the interface has
// to say about any number on screen:
//
//   * `fixture` — the synthetic ingest/fixtures/ dataset at null island. Every
//     value is invented.
//   * `real`    — a real Landkreis, ingested from the sources in
//     docs/data/sources.md. The *values* are real measurements; the *scoring*
//     is still illustrative (lib/scoring/illustrative-weights.ts) until
//     docs/domain/scoring-criteria.md's weights are confirmed.
//
// `components/IllustrativeBanner.tsx` words itself by this kind, so a screen
// can never describe real measurements as synthetic, or synthetic ones as real.

export type PilotRegionKind = "fixture" | "real";

export interface PilotRegionInfo {
  readonly id: string;
  readonly kind: PilotRegionKind;
  /** How the region is named in the interface. */
  readonly nameDe: string;
  /**
   * Which legal regimes its units fall under — used by the 3D preview
   * (ADR-0006) to decide which cited setback rings apply. Stated per region
   * rather than derived per unit because no *Bundesland* boundary is loaded;
   * a region straddling a state border would need that.
   */
  readonly jurisdictions: readonly ("DE" | "DE-BB")[];
  /**
   * For the fixture only: the region its rings are drawn *as if* it lay in.
   * The fixture belongs to no jurisdiction; the preview says so in words.
   */
  readonly asIfIn?: string;
}

export const PILOT_REGIONS: Readonly<Record<string, PilotRegionInfo>> = {
  "uckermark-12073": {
    id: "uckermark-12073",
    kind: "real",
    nameDe: "Uckermark",
    jurisdictions: ["DE", "DE-BB"],
  },
  "fixture-region": {
    id: "fixture-region",
    kind: "fixture",
    nameDe: "Beispieldatensatz",
    jurisdictions: ["DE", "DE-BB"],
    asIfIn: "Landkreis Uckermark (Brandenburg)",
  },
};

/** The real pilot region (ingest/real/, `PILOT_REGION` in ingest/run.sh). */
export const REAL_PILOT_REGION = "uckermark-12073";
export const FIXTURE_PILOT_REGION = "fixture-region";

/**
 * Region the explorer shows when none is asked for: `SELA_PILOT_REGION` if
 * set, otherwise the real region. Callers fall back to the fixture when the
 * real region has no units in this database (e.g. CI, which only ingests the
 * fixture) — see resolvePilotRegion in lib/db/queries/regions.ts.
 */
export const DEFAULT_PILOT_REGION = process.env.SELA_PILOT_REGION ?? REAL_PILOT_REGION;

export function pilotRegionInfo(id: string): PilotRegionInfo {
  return (
    PILOT_REGIONS[id] ?? {
      id,
      // An unregistered region is treated as synthetic: claiming "real" for
      // data nobody registered would be the worse mistake.
      kind: "fixture",
      nameDe: id,
      jurisdictions: [],
    }
  );
}
