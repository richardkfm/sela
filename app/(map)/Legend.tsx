// What the map's colours mean, for the technology currently shown — with the
// count of units in each class, so the legend is also the first, smallest
// table view of the map (design-language.md §6: "a table view is always
// reachable"). The bars share one axis: the total number of units.

import {
  MAP_VERDICTS,
  TECHNOLOGY_LABEL_DE,
  VERDICT_EXPLANATION_DE,
  VERDICT_LABEL_DE,
  patternClass,
  verdictAppearance,
  type MapVerdict,
} from "@/lib/map/verdict-style";
import type { Technology } from "@/lib/scoring/types";
import Link from "next/link";

const COUNT = new Intl.NumberFormat("de-DE");

export function Legend({
  technology,
  counts,
  total,
}: {
  technology: Technology;
  /** Undefined while this technology's counts are loading. */
  counts: Record<MapVerdict, number> | undefined;
  total: number;
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
          {MAP_VERDICTS.map((verdict) => {
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
      <p className="explorer-note muted">
        Schwelle und Gewichte sind Platzhalter. <Link href="/method">Wie bewertet wird →</Link>
      </p>
    </section>
  );
}
