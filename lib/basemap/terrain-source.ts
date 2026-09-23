// Terrain for the 3D parcel preview (ADR-0006) — and only for it. The 2D map
// explorer never requests elevation.
//
// **basemap.de 3D Gelände** (BKG, on behalf of the Länder): DGM5-derived
// elevation, served as Mapbox-encoded terrain-RGB PNGs in EPSG:3857. Checked
// against the live service on 2026-09-23, not only its documentation:
//
// - Tiles are **512 px**, although the product page says 256. Declaring 256
//   would make MapLibre place every elevation sample at twice its real
//   distance.
// - Encoding is Mapbox's (`-10000 + (R·65536 + G·256 + B) · 0.1`); decoding a
//   z12 tile over the Uckermark gave 17.8–80.6 m, where the Terrarium
//   formula gave nonsense.
// - Tiles exist up to z15 and return 404 above it and outside Germany, so the
//   source declares both `maxzoom` and `bounds` and MapLibre never asks for
//   what is not there.
// - CORS is open (`Access-Control-Allow-Origin` echoes the page's origin).
//
// **The licence is not basemap.de's CC BY 4.0.** The 3D services have their
// own terms, *basemap.de 3D-Beta Dienste* (lizenz_basemapde_3D-Beta.pdf, read
// 2026-09-23): usage rights are granted "zu Testzwecken" for the beta phase;
// data may be used only through the service and stored only at runtime; the
// notice `© GeoBasis-DE/BKG <Jahr>` must be clearly visible, with a change
// notice where the service is combined with others. The preview does exactly
// that — runtime display, nothing stored, nothing sampled into
// criterion_value — but "for testing purposes" is not a licence for a public
// 1.0 launch. docs/data/sources.md records this as a release blocker.
//
// `SELA_TERRAIN` selects it:
//   auto (default) | basemapde3d — the service above
//   none                         — flat ground; the preview still works

export type TerrainKind = "basemapde3d" | "none";

export interface TerrainDescriptor {
  readonly kind: TerrainKind;
  readonly tiles: readonly string[];
  readonly tileSize: number;
  readonly maxzoom: number;
  /** West, south, east, north — requests outside are never made. */
  readonly bounds: readonly [number, number, number, number];
  /** Plain text, for anything that cannot carry links. */
  readonly attribution: string;
  /** The bare Quellenvermerk with its change notice, for places that already say "Gelände". */
  readonly notice: string;
  readonly attributionHtml: string;
}

export const BASEMAPDE_3D_TERRAIN_TILES = [
  "https://sg.geodatenzentrum.de/gdz_basemapde_3d_gelaende/dgm5_rgb_tiles/{z}/{x}/{y}.png",
];

/** Germany's extent with a small margin; the service has no data beyond it. */
const GERMANY_BOUNDS: TerrainDescriptor["bounds"] = [5.5, 47.0, 15.5, 55.2];

export function resolveTerrainKind(): TerrainKind {
  const requested = (process.env.SELA_TERRAIN ?? "auto").toLowerCase();
  switch (requested) {
    case "none":
      return "none";
    case "auto":
    case "basemapde3d":
      return "basemapde3d";
    default:
      console.warn(`unrecognised SELA_TERRAIN='${requested}' — falling back to 'auto'`);
      return "basemapde3d";
  }
}

export function describeTerrain(kind: TerrainKind): TerrainDescriptor | null {
  if (kind === "none") return null;
  // A live service, so the year of retrieval is the current one — the same
  // reasoning basemap-source.ts applies to the 2D basemap. "Daten verändert"
  // is the change notice §3.2 of the licence asks for once the service is
  // combined with others, which the preview always does.
  const year = new Date().getFullYear();
  return {
    kind,
    tiles: BASEMAPDE_3D_TERRAIN_TILES,
    tileSize: 512,
    maxzoom: 15,
    bounds: GERMANY_BOUNDS,
    attribution: `Gelände: © GeoBasis-DE/BKG ${year} (Daten verändert)`,
    notice: `© GeoBasis-DE/BKG ${year} (Daten verändert)`,
    attributionHtml: `Gelände: © GeoBasis-DE/<a href="https://www.bkg.bund.de">BKG</a> ${year} (Daten verändert)`,
  };
}
