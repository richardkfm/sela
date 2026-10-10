// The regions sela knows about, and what each one is (ADR-0012).
//
// Two things are said about any region, and both decide what a screen may
// claim about its numbers:
//
//   * its data kind — `fixture` (the synthetic ingest/fixtures/ dataset at
//     null island; every value is invented) or `real` (ingested from the
//     sources in docs/data/sources.md; the values are real measurements,
//     classified by the decided rules);
//   * its level — a `land` (Brandenburg, Sachsen), a `kreis` within one, or
//     the `fixture`.
//
// Which regions exist, their names and their boundaries live in the `region`
// table (migration 0010), written at ingest from BKG VG25; this module only
// knows what can be read off a region id without the database — enough for
// `components/MethodNote.tsx` to word itself, and for the 3D preview to know
// which Land's setback rules apply. The static part is the Länder: which
// jurisdictions they are under and which Land sources feed them.

export type PilotRegionKind = "fixture" | "real";
export type RegionLevel = "fixture" | "land" | "kreis";
export type Jurisdiction = "DE" | "DE-BB" | "DE-SN";

export interface LandConfig {
  /** Amtlicher Gemeindeschlüssel of the Land — the first two digits of every AGS inside it. */
  readonly ags: string;
  /** The region id of the Land as a whole (its own grid). */
  readonly id: string;
  readonly nameDe: string;
  readonly jurisdictions: readonly Jurisdiction[];
  /**
   * The Land's protected-area source (docs/data/sources.md), which the
   * exclusion and the Prüfhinweise cite; per Land because each Land publishes
   * its own (BfN's federal service is blocked, sources.md §2.1).
   */
  readonly protectionSourceId: string;
  /** The authority named in the advisory note beside DWD and BKG. */
  readonly protectionAuthorityDe: string;
  /**
   * Which outcome inputs the Land has a confirmed source for. Where one is
   * missing the methods say *noch nicht modelliert*; the screens add that the
   * data is not loaded for this Land, so a thin comparison is never read as a
   * statement about the land (roadmap-planning-tool.md R2).
   */
  readonly outcomeSources: { readonly peat: boolean; readonly water: boolean; readonly habitat: boolean };
}

export const LAENDER: Readonly<Record<string, LandConfig>> = {
  "12": {
    ags: "12",
    id: "brandenburg-12",
    nameDe: "Brandenburg",
    jurisdictions: ["DE", "DE-BB"],
    protectionSourceId: "lfu-bb-schutzgebiete",
    protectionAuthorityDe: "LfU Brandenburg",
    outcomeSources: { peat: true, water: true, habitat: true },
  },
  "14": {
    ags: "14",
    id: "sachsen-14",
    nameDe: "Sachsen",
    jurisdictions: ["DE", "DE-SN"],
    protectionSourceId: "lfulg-sn-schutzgebiete",
    protectionAuthorityDe: "LfULG Sachsen",
    // docs/product/roadmap-planning-tool.md A4: no Saxon or national source has
    // passed the licence gate for these yet (sources.md §2.14).
    outcomeSources: { peat: false, water: false, habitat: false },
  },
};

export interface PilotRegionInfo {
  readonly id: string;
  readonly kind: PilotRegionKind;
  readonly level: RegionLevel;
  /** How the region is named in the interface; the database row has the authoritative name. */
  readonly nameDe: string;
  /** 2 digits for a Land, 5 for a Kreis, null for the fixture. */
  readonly ags: string | null;
  /** The Land this region lies in (or is), by its config; null for the fixture. */
  readonly land: LandConfig | null;
  /**
   * Which legal regimes its units fall under — used by the 3D preview
   * (ADR-0006) to decide which cited setback rings apply. Per region, from
   * its Land; a region never straddles a Land border (the hierarchy is by AGS).
   */
  readonly jurisdictions: readonly Jurisdiction[];
  /**
   * For the fixture only: the region its rings are drawn *as if* it lay in.
   * The fixture belongs to no jurisdiction; the preview says so in words.
   */
  readonly asIfIn?: string;
}

export const FIXTURE_PILOT_REGION = "fixture-region";
/** The Landkreis sela shipped first; still the smallest real region to install. */
export const REAL_PILOT_REGION = "uckermark-12073";

/**
 * Region the explorer shows when none is asked for: `SELA_REGION` (or the
 * older `SELA_PILOT_REGION`) if set, otherwise the Uckermark. Callers fall
 * back to the first region with cells — see resolveRegion in
 * lib/db/queries/regions.ts.
 */
export const DEFAULT_PILOT_REGION = process.env.SELA_REGION ?? process.env.SELA_PILOT_REGION ?? REAL_PILOT_REGION;

/** Names for the ids that have shipped, so a region reads right before its row is loaded. */
const KNOWN_NAMES_DE: Readonly<Record<string, string>> = {
  "uckermark-12073": "Uckermark",
  "brandenburg-12": "Brandenburg",
  "sachsen-14": "Sachsen",
  [FIXTURE_PILOT_REGION]: "Beispieldatensatz",
};

const REGION_ID = /^[a-z0-9-]+-(\d{2}|\d{5})$/;

/**
 * What a region id says by itself: `<slug>-<ags>` is a real Land (2 digits)
 * or Kreis (5 digits) under its Land's rules; anything else is treated as
 * synthetic — claiming "real" for data nobody registered would be the worse
 * mistake.
 */
export function pilotRegionInfo(id: string): PilotRegionInfo {
  const match = REGION_ID.exec(id);
  const land = match ? (LAENDER[match[1]!.slice(0, 2)] ?? null) : null;
  if (!match || !land) {
    // The shipped fixture draws its setback rings *as if* it lay in the
    // Uckermark (the preview says so in words); any other unregistered id
    // belongs to no jurisdiction at all.
    const shipped = id === FIXTURE_PILOT_REGION;
    return {
      id,
      kind: "fixture",
      level: "fixture",
      nameDe: KNOWN_NAMES_DE[id] ?? id,
      ags: null,
      land: null,
      jurisdictions: shipped ? ["DE", "DE-BB"] : [],
      asIfIn: shipped ? "Landkreis Uckermark (Brandenburg)" : undefined,
    };
  }
  const ags = match[1]!;
  return {
    id,
    kind: "real",
    level: ags.length === 2 ? "land" : "kreis",
    nameDe: KNOWN_NAMES_DE[id] ?? id.slice(0, id.length - ags.length - 1).replace(/-/g, " "),
    ags,
    land,
    jurisdictions: land.jurisdictions,
  };
}

/** The Land config for a region id (its own, or its parent's); null for the fixture. */
export function landOf(regionId: string): LandConfig | null {
  return pilotRegionInfo(regionId).land;
}
