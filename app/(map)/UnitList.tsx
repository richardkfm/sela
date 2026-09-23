"use client";

// The concrete keyboard path into unit selection (design-language.md §9:
// "a map that only answers a mouse excludes the people it's for"). With a
// real region's ~117 000 units a full list would be useless as well as slow,
// so the list shows the units *in view* — the same set the map is drawing —
// and grows or shrinks as the reader pans and zooms. Activating one selects
// it on the map exactly as a click would.

import { VERDICT_LABEL_DE, patternClass, verdictAppearance } from "@/lib/map/verdict-style";
import type { Technology } from "@/lib/scoring/types";
import type { VisibleUnit } from "./Map";

/** Enough to scan and tab through; beyond this the reader is better served by zooming in. */
const MAX_LISTED = 40;

const COUNT = new Intl.NumberFormat("de-DE");

export function UnitList({
  units,
  regionUnitCount,
  technology,
  selectedId,
  onSelect,
}: {
  /** Units currently drawn, or null when zoomed out beyond where single units can be selected. */
  units: readonly VisibleUnit[] | null;
  regionUnitCount: number;
  technology: Technology;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const listed = units?.slice(0, MAX_LISTED) ?? [];
  return (
    <nav aria-label="Flächen in der Pilotregion" className="explorer-section explorer-list">
      <h2 className="overline">
        Flächen im Ausschnitt{" "}
        <span className="tabular-nums">
          ({units ? COUNT.format(units.length) : "–"} von {COUNT.format(regionUnitCount)})
        </span>
      </h2>
      {units === null && (
        <p className="explorer-note muted">
          Hineinzoomen oder in die Karte klicken, um einzelne Flächen auszuwählen. In dieser Übersicht ist jede Fläche
          kleiner als ein Bildpunkt.
        </p>
      )}
      {units && units.length === 0 && <p className="explorer-note muted">Im Ausschnitt liegen keine Flächen.</p>}
      <ul className="unit-list">
        {listed.map((unit) => {
          const { verdict, score } = unit.byTechnology[technology];
          const appearance = verdictAppearance(verdict, technology);
          return (
            <li key={unit.id}>
              <button
                type="button"
                aria-current={selectedId === unit.id ? "true" : undefined}
                onClick={() => onSelect(unit.id)}
              >
                <span
                  aria-hidden
                  className={`swatch ${patternClass(appearance.encoding) ?? ""}`}
                  style={{ backgroundColor: appearance.color }}
                />
                <span className="tabular-nums">{unit.id.slice(0, 8)}</span>
                <span className="muted">
                  {VERDICT_LABEL_DE[verdict]}
                  {score != null && <span className="tabular-nums"> · {score.toFixed(2)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {units && units.length > MAX_LISTED && (
        <p className="explorer-note muted">
          {COUNT.format(units.length - MAX_LISTED)} weitere im Ausschnitt — hineinzoomen, um die Liste einzugrenzen.
        </p>
      )}
    </nav>
  );
}
