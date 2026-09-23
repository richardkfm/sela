"use client";

// The concrete keyboard path into unit selection (design-language.md §9:
// "a map that only answers a mouse excludes the people it's for") — every
// unit the map shows is also a plain, tab-reachable button here. Activating
// one selects it on the map exactly as a click would, and the selection card
// carries the way on to the unit's own pages.

import type { GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import { VERDICT_LABEL_DE, patternClass, verdictAppearance } from "@/lib/map/verdict-style";
import type { SuitabilityVerdict, Technology } from "@/lib/scoring/types";

export function UnitList({
  units,
  verdictByUnit,
  technology,
  selectedId,
  onSelect,
}: {
  units: GeoJSONFeatureCollection;
  verdictByUnit: ReadonlyMap<string, SuitabilityVerdict>;
  technology: Technology;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Flächen in der Pilotregion" className="explorer-section explorer-list">
      <h2 className="overline">
        Flächen <span className="tabular-nums">({units.features.length})</span>
      </h2>
      <ul className="unit-list">
        {units.features.map((feature) => {
          const verdict = verdictByUnit.get(String(feature.id));
          const appearance = verdictAppearance(verdict?.verdict ?? "unscored", technology);
          return (
            <li key={feature.id}>
              <button
                type="button"
                aria-current={selectedId === feature.id ? "true" : undefined}
                onClick={() => onSelect(String(feature.id))}
              >
                <span
                  aria-hidden
                  className={`swatch ${patternClass(appearance.encoding) ?? ""}`}
                  style={{ backgroundColor: appearance.color }}
                />
                <span className="tabular-nums">{String(feature.id).slice(0, 8)}</span>
                <span className="muted">
                  {verdict ? VERDICT_LABEL_DE[verdict.verdict] : VERDICT_LABEL_DE.unscored}
                  {verdict?.score != null && <span className="tabular-nums"> · {verdict.score.toFixed(2)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
