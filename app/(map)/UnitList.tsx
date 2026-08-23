// The concrete keyboard path into unit selection (design-language.md §9:
// "a map that only answers a mouse excludes the people it's for") — every
// unit the map shows is also a plain, tab-reachable link here.

import Link from "next/link";
import type { GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import type { SuitabilityVerdict } from "@/lib/scoring/types";

const VERDICT_LABEL_DE: Record<SuitabilityVerdict["verdict"], string> = {
  suitable: "geeignet",
  unsuitable: "ungeeignet",
  excluded: "ausgeschlossen",
};

export function UnitList({
  units,
  verdicts,
}: {
  units: GeoJSONFeatureCollection;
  verdicts: readonly SuitabilityVerdict[];
}) {
  const verdictByUnit = new Map(verdicts.map((v) => [v.spatialUnitId, v]));

  return (
    <nav aria-label="Flächen in der Pilotregion" style={{ height: "100%", overflowY: "auto" }}>
      <h2 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.03em", padding: "0.75rem 0.75rem 0.25rem", margin: 0, color: "var(--text-secondary)" }}>
        Flächen ({units.features.length})
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {units.features.map((feature) => {
          const verdict = verdictByUnit.get(String(feature.id));
          return (
            <li key={feature.id}>
              <Link
                href={`/unit/${feature.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.5rem 0.75rem",
                  borderBottom: "1px solid var(--surface-1)",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                <span className="tabular-nums">{String(feature.id).slice(0, 8)}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {verdict ? VERDICT_LABEL_DE[verdict.verdict] : "…"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
