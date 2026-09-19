// Rendering a source's Quellenvermerk, and refusing to render one that does
// not exist.
//
// docs/data/sources.md §3 records what each publisher demands, verbatim and
// per product — they are not interchangeable even within one agency (BKG's
// CLC5 wants "© GeoBasis-DE / BKG <Jahr>", its VG25 wants "© BKG <Jahr>").
// The text lives on the source row; this module only substitutes the year
// and attaches the change notice.
//
// design-language.md §7's binding rule — "a card that cannot cite itself
// must not render" — is implemented here as `isCitable`, so callers can fail
// before producing an image rather than after.

import type { SourceRow } from "@/lib/db/queries/criteria";

/**
 * Written by migration 0003 onto rows that predate the attribution column.
 * Matched verbatim rather than by `includes`, so a real notice that happens
 * to discuss citability is never mistaken for this marker.
 */
export const UNCITABLE_ATTRIBUTION = "Quellenvermerk nicht hinterlegt — Quelle nicht zitierfähig";

/** The Veränderungshinweis every altered-data licence in the inventory wants. */
export const CHANGE_NOTICE_DE = "(Daten verändert)";

/** The placeholder a source row leaves for the year of last data retrieval. */
const YEAR_PLACEHOLDER = "<Jahr>";

export function isCitable(source: SourceRow): boolean {
  return source.attribution.trim().length > 0 && source.attribution !== UNCITABLE_ATTRIBUTION;
}

/**
 * The notice as it must appear, with `<Jahr>` resolved.
 *
 * The year is the source's own retrieval year where one is recorded — not
 * today's. Every licence here asks for the "Jahr des letzten Datenbezugs",
 * and for a pinned artefact that is when sela fetched it, which does not
 * change just because the calendar did. `fallbackYear` covers live services
 * (a tile endpoint has no retrieval date) and defaults to the current year.
 */
export function renderAttribution(
  source: SourceRow,
  options: { fallbackYear?: number } = {},
): string {
  const year = source.retrievedAt?.slice(0, 4) ?? String(options.fallbackYear ?? new Date().getFullYear());
  const notice = source.attribution.replaceAll(YEAR_PLACEHOLDER, year);
  return source.changeNoticeRequired ? `${notice} ${CHANGE_NOTICE_DE}` : notice;
}

/**
 * Splits a set of sources into the ones that can be cited and the ones that
 * cannot. Callers bound by §7's rule should treat a non-empty `uncitable`
 * as a refusal to render, not as a list to quietly drop.
 */
export function partitionByCitability(sources: readonly SourceRow[]): {
  citable: SourceRow[];
  uncitable: SourceRow[];
} {
  const citable: SourceRow[] = [];
  const uncitable: SourceRow[] = [];
  for (const source of sources) {
    (isCitable(source) ? citable : uncitable).push(source);
  }
  return { citable, uncitable };
}
