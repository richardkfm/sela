// What the map's colours mean, for the technology currently shown — with the
// count of units in each class, so the legend is also the first, smallest
// table view of the map (design-language.md §6: "a table view is always
// reachable"). The bars share one axis: the total number of units.
//
// Below the cell zoom the map shows the overview pyramid (ADR-0012): each
// hexagon in the colour of its *most frequent* class. The counts stay the
// region's cell counts; the legend says what the hexagons are, so a 5 km
// hexagon in amber is never read as "this area is buildable" (design-
// language.md §4.2b).

import {
  CLASSIFICATION_NOTE_DE,
  INK,
  TECHNOLOGY_LABEL_DE,
  VERDICT_EXPLANATION_DE,
  VERDICT_LABEL_DE,
  mapVerdictsFor,
  patternClass,
  verdictAppearance,
  type MapVerdict,
} from "@/lib/map/verdict-style";
import { CELL_MIN_ZOOM, INTERACTIVE_MIN_ZOOM } from "@/lib/map/tiles";
import type { PilotRegionKind } from "@/lib/pilot-region";
import type { Technology } from "@/lib/scoring/types";
import Link from "next/link";

const COUNT = new Intl.NumberFormat("de-DE");

/** The legend's line for the overview, shared with the design language and the method page. */
export const OVERVIEW_NOTE_DE = `Übersicht (unter Zoomstufe ${CELL_MIN_ZOOM}): jede Wabe von 1 km oder 5 km trägt die Farbe der häufigsten Einordnung ihrer Zellen; der Anteil erscheint beim Zeigen. Keine Zelle ist hier einzeln sichtbar.`;

export function Legend({
  technology,
  counts,
  total,
  regionKind,
  overview,
  hasOverview,
}: {
  technology: Technology;
  regionKind: PilotRegionKind;
  /** Undefined while this technology's counts are loading. */
  counts: Record<MapVerdict, number> | undefined;
  total: number;
  /** Whether the map is currently below the cell zoom. */
  overview: boolean;
  /** Whether the overview pyramid exists for this region (materialised). */
  hasOverview: boolean;
}) {
  return (
    <section aria-labelledby="legend-heading" className="explorer-section">
      <h2 id="legend-heading" className="overline">
        Legende · {TECHNOLOGY_LABEL_DE[technology]}
      </h2>
      <table className="legend-table">
        <caption className="visually-hidden">
          Anzahl der Flächen je Eignungsklasse für {TECHNOLOGY_LABEL_DE[technology]}
        </caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">Klasse</th>
            <th scope="col">Anzahl</th>
            <th scope="col">Anteil</th>
          </tr>
        </thead>
        <tbody>
          {mapVerdictsFor(regionKind).map((verdict) => {
            const appearance = verdictAppearance(verdict, technology);
            const count = counts?.[verdict];
            return (
              <tr key={verdict}>
                <th scope="row">
                  <span
                    aria-hidden
                    className={`swatch ${patternClass(appearance.encoding) ?? ""}`}
                    style={{ backgroundColor: appearance.color }}
                  />
                  <span>
                    <span className="legend-label">{VERDICT_LABEL_DE[verdict]}</span>
                    <span className="legend-explanation muted">{VERDICT_EXPLANATION_DE[verdict]}</span>
                  </span>
                </th>
                <td className="tabular-nums">{count === undefined ? "…" : COUNT.format(count)}</td>
                <td>
                  <span className="legend-bar" aria-hidden>
                    <span style={{ width: total && count !== undefined ? `${(count / total) * 100}%` : 0 }} />
                  </span>
                  <span className="visually-hidden">
                    {total && count !== undefined ? Math.round((count / total) * 100) : 0} %
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {overview && (
        <p className="explorer-note muted legend-overview" role="status">
          {hasOverview
            ? OVERVIEW_NOTE_DE
            : `Für dieses Gebiet ist die Übersicht noch nicht berechnet (pnpm db:materialize). Zellen erscheinen ab Zoomstufe ${CELL_MIN_ZOOM}.`}
        </p>
      )}
      {regionKind === "real" ? (
        <>
          {technology !== "wind" && (
            <p className="explorer-note muted legend-flag">
              <span aria-hidden className="legend-flag-swatch" style={{ borderColor: INK }} />
              <span>Gestrichelt umrandet: mindestens ein Prüfhinweis zu Schutzgebieten (ab Zoomstufe {INTERACTIVE_MIN_ZOOM} sichtbar).</span>
            </p>
          )}
          <p className="explorer-note muted">
            {CLASSIFICATION_NOTE_DE} <Link href="/method">Wie eingeordnet wird →</Link>
          </p>
        </>
      ) : (
        <p className="explorer-note muted">
          Schwelle und Gewichte sind Platzhalter. <Link href="/method">Wie bewertet wird →</Link>
        </p>
      )}
    </section>
  );
}
