// Flow F1 (mvp.md): find land by coordinates. Pure parsing only — the point is
// placed in a cell by PostGIS (lib/db/queries/municipalities.ts), never by
// geometry in TypeScript (ADR-0002).
//
// Accepted, because these are what a planning office or a phone hands over:
//
// - WGS84 decimal degrees, "53.0123, 13.9876" or with German decimal commas
//   "53,0123 13,9876", optionally with N/E. The order does not matter inside
//   Germany: latitudes (47–55.1) and longitudes (5.8–15.1) do not overlap, so
//   which number is which is read from its range, and the reader is told how
//   it was read.
// - ETRS89 / UTM, Brandenburg's official reference system: "33U 412345 5881234",
//   "32N 812345 5911234", or an eight-digit easting with the zone prefix
//   ("33412345 5881234"). Six-digit eastings without a zone are read as zone 33
//   (EPSG:25833, the zone Brandenburg's own data uses) and the reading says so.

export type ParsedCoordinates =
  | { readonly kind: "wgs84"; readonly lat: number; readonly lon: number; readonly readAsDe: string }
  | {
      readonly kind: "utm";
      readonly zone: 32 | 33;
      readonly easting: number;
      readonly northing: number;
      /** EPSG code of the zone's ETRS89 / UTM system. */
      readonly epsg: 25832 | 25833;
      readonly readAsDe: string;
    };

// Germany's extent, generously: anything outside is not a German coordinate
// and is not guessed at.
const LAT = { min: 47, max: 55.2 };
const LON = { min: 5.5, max: 15.5 };

const NUMBER = /[-+]?\d+(?:[.,]\d+)?/g;

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

const DEG = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
const METRE = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0, useGrouping: false });

function wgs84(lat: number, lon: number): ParsedCoordinates {
  return { kind: "wgs84", lat, lon, readAsDe: `gelesen als ${DEG.format(lat)}° N, ${DEG.format(lon)}° O (WGS84)` };
}

function utm(zone: 32 | 33, easting: number, northing: number, zoneAssumed: boolean): ParsedCoordinates | null {
  // A UTM easting lies within ±~340 km of the 500 km false easting at German
  // latitudes; a northing in Germany between 5.2 and 6.15 million metres.
  if (easting < 160_000 || easting > 840_000 || northing < 5_200_000 || northing > 6_150_000) return null;
  const epsg = zone === 32 ? 25832 : 25833;
  return {
    kind: "utm",
    zone,
    easting,
    northing,
    epsg,
    readAsDe:
      `gelesen als ETRS89 / UTM Zone ${zone}: Ost ${METRE.format(easting)}, Nord ${METRE.format(northing)}` +
      (zoneAssumed ? " (Zone 33 angenommen, wie in Brandenburg üblich)" : ""),
  };
}

/**
 * Coordinates in `input`, or null when it does not read as a German
 * coordinate. Two decimal commas and a separating space ("53,1 13,9") are read
 * as two numbers, as are "53.1,13.9" and "53.1, 13.9".
 */
export function parseCoordinates(input: string): ParsedCoordinates | null {
  const text = input.trim();
  if (text === "") return null;

  // UTM with an explicit zone: "33U 412345 5881234", "32N 812345 5911234", "33 412345 5881234".
  const zoned = /^(32|33)\s*[a-zA-Z]?\s+(\d{6}(?:[.,]\d+)?)\s*[,;]?\s*(\d{7}(?:[.,]\d+)?)$/.exec(text);
  if (zoned) {
    return utm(Number(zoned[1]) as 32 | 33, toNumber(zoned[2]!), toNumber(zoned[3]!), false);
  }
  // Easting with a zone prefix: "33412345 5881234".
  const prefixed = /^(32|33)(\d{6}(?:[.,]\d+)?)\s*[,;]?\s*(\d{7}(?:[.,]\d+)?)$/.exec(text);
  if (prefixed) {
    return utm(Number(prefixed[1]) as 32 | 33, toNumber(prefixed[2]!), toNumber(prefixed[3]!), false);
  }
  // Plain six-digit easting, seven-digit northing: zone 33 assumed.
  const plain = /^(?:[EeOo]\s*)?(\d{6}(?:[.,]\d+)?)\s*[,;]?\s*(?:[Nn]\s*)?(\d{7}(?:[.,]\d+)?)$/.exec(text);
  if (plain) {
    return utm(33, toNumber(plain[1]!), toNumber(plain[2]!), true);
  }

  // Decimal degrees. With German decimal commas the separator must be
  // whitespace or a semicolon; "53,1,13,9" is ambiguous and not guessed at.
  const cleaned = text.replace(/[°]/g, " ").replace(/\b[NnEeOo]\b/g, " ");
  let parts: string[];
  if (/^\s*[-+]?\d+,\d+\s*[;\s]\s*[-+]?\d+,\d+\s*$/.test(cleaned)) {
    parts = cleaned.match(NUMBER) ?? [];
  } else if (/^\s*[-+]?\d+(?:\.\d+)?\s*[,;\s]\s*[-+]?\d+(?:\.\d+)?\s*$/.test(cleaned)) {
    parts = cleaned.split(/[,;\s]+/).filter(Boolean);
  } else {
    return null;
  }
  if (parts.length !== 2) return null;
  const [a, b] = parts.map(toNumber) as [number, number];
  const isLat = (v: number) => v >= LAT.min && v <= LAT.max;
  const isLon = (v: number) => v >= LON.min && v <= LON.max;
  if (isLat(a) && isLon(b)) return wgs84(a, b);
  if (isLon(a) && isLat(b)) return wgs84(b, a);
  return null;
}

/** Search text normalised for matching Gemeinde names: case, umlauts and ß folded, punctuation dropped. */
export function normaliseName(text: string): string {
  return text
    .toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Gemeinden whose name matches `input`: names that start with it first, then
 * names that contain it, each alphabetically. Empty input matches nothing.
 */
export function matchNames<T extends { readonly name: string }>(candidates: readonly T[], input: string): T[] {
  const needle = normaliseName(input);
  if (needle === "") return [];
  const scored = candidates
    .map((candidate) => {
      const name = normaliseName(candidate.name);
      const words = name.split(" ");
      const rank = name.startsWith(needle) ? 0 : words.some((w) => w.startsWith(needle)) ? 1 : name.includes(needle) ? 2 : -1;
      return { candidate, rank };
    })
    .filter((s) => s.rank >= 0);
  return scored
    .sort((x, y) => x.rank - y.rank || x.candidate.name.localeCompare(y.candidate.name, "de"))
    .map((s) => s.candidate);
}
