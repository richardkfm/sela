// Scenario comparison (roadmap §5.1) — the centrepiece: all scenarios on
// identical outcome dimensions, deltas against status_quo, always with a
// reachable table view (design-language.md §9: a table view reachable from
// every chart). Phase 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { notFound } from "next/navigation";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { NotModelledBadge } from "@/components/NotModelledBadge";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listOutcomesForUnit } from "@/lib/db/queries/outcomes";
import { scenarioTokenCssVar, scenarioTokens } from "@/lib/design/tokens";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { OUTCOME_DIMENSIONS, SCENARIOS, type OutcomeDimension, type Scenario } from "@/lib/scoring/types";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const DIMENSION_LABEL_DE: Record<OutcomeDimension, string> = {
  energy: "Energie",
  climate: "Klima",
  nature_capital: "Naturkapital",
  soil_water: "Boden & Wasser",
  land_use: "Flächennutzung",
  local_benefit: "Regionaler Nutzen",
};

const SCENARIO_TOKEN_KEY: Record<Scenario, keyof typeof scenarioTokens> = {
  status_quo: "statusQuo",
  develop_pv: "solarPv",
  develop_agripv: "agriPv",
  develop_wind: "onshoreWind",
  preserve: "preserve",
  restore: "restore",
};

function formatValue(value: number, unit: string | null): string {
  return unit ? `${value} ${unit}` : `${value}`;
}

export default async function CompareScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) notFound();

  const rows = await listOutcomesForUnit(id, CURRENT_METHOD_VERSION);
  const byDimensionScenario = new Map(rows.map((r) => [`${r.dimension}:${r.scenario}`, r]));
  const energyMax = Math.max(
    1,
    ...rows.filter((r) => r.dimension === "energy" && r.outcome.status === "modelled").map((r) => r.outcome.value ?? 0),
  );

  return (
    <main style={{ padding: "1.5rem", maxWidth: "64rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <IllustrativeBanner />
      <div>
        <Link href={`/unit/${id}`}>← Zur Fläche</Link>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>
          Szenarienvergleich — Fläche <span className="tabular-nums">{id.slice(0, 8)}</span>
        </h1>
      </div>

      {/* Decorative headline visual — energy output per scenario. The table
          below is the authoritative, screen-reader- and keyboard-reachable
          view (design-language.md §9); this SVG adds nothing this page
          doesn't already say in text. Each bar carries its scenario's
          secondary encoding pattern, not colour alone (design-language.md
          §4.3 obligation 1) — this is exactly the fill the greyscale test
          (tests/e2e/greyscale.spec.ts) checks. */}
      <svg aria-hidden viewBox="0 0 480 140" style={{ width: "100%", maxWidth: "32rem", height: "auto" }}>
        <defs>
          <pattern id="pat-hatch-45" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeWidth="2.5" strokeOpacity="0.6" />
          </pattern>
          <pattern id="pat-hatch-135" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeWidth="2.5" strokeOpacity="0.6" />
          </pattern>
          <pattern id="pat-crosshatch-45" width="7" height="7" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeWidth="2" strokeOpacity="0.6" transform="rotate(45 3.5 3.5)" />
            <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeWidth="2" strokeOpacity="0.6" transform="rotate(135 3.5 3.5)" />
          </pattern>
          <pattern id="pat-stipple" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.1" fill="white" fillOpacity="0.65" />
          </pattern>
        </defs>
        {SCENARIOS.map((scenario, i) => {
          const row = byDimensionScenario.get(`energy:${scenario}`);
          const value = row?.outcome.status === "modelled" ? (row.outcome.value ?? 0) : 0;
          const barWidth = Math.max((value / energyMax) * 380, 1);
          const tokenKey = SCENARIO_TOKEN_KEY[scenario];
          const token = scenarioTokens[tokenKey];
          const y = i * 22 + 6;
          return (
            <g key={scenario}>
              <text x="0" y={y + 12} fontSize="11" fill="currentColor">
                {token.labelDe}
              </text>
              <rect x="90" y={y} width={barWidth} height="14" fill={`var(${scenarioTokenCssVar[tokenKey]})`} />
              {token.secondaryEncoding !== "none" && token.secondaryEncoding !== "solid" && (
                <rect x="90" y={y} width={barWidth} height="14" fill={`url(#pat-${token.secondaryEncoding})`} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Pattern legend — decodes the chart's (and every fill elsewhere in
          the app's) secondary encodings for colourblind vision and
          greyscale print (design-language.md §4.3 obligation 1); also
          gives tests/e2e/greyscale.spec.ts a fixed-size, always-visible
          swatch per scenario to sample, since the energy chart's own bars
          are legitimately zero-width for scenarios with no energy output. */}
      <div aria-hidden style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {SCENARIOS.map((scenario) => {
          const tokenKey = SCENARIO_TOKEN_KEY[scenario];
          const token = scenarioTokens[tokenKey];
          return (
            <div key={scenario} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                data-testid="scenario-swatch"
                data-scenario={scenario}
                data-encoding={token.secondaryEncoding}
                className={token.secondaryEncoding !== "none" ? `pattern-${token.secondaryEncoding}` : undefined}
                style={{
                  display: "inline-block",
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: "0.2rem",
                  backgroundColor: `var(${scenarioTokenCssVar[tokenKey]})`,
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{token.labelDe}</span>
            </div>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9rem" }}>
          <caption style={{ textAlign: "left", captionSide: "top", padding: "0 0 0.5rem", color: "var(--text-secondary)" }}>
            Alle Werte gegenüber dem Ist-Zustand (Δ)
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}>
                Dimension
              </th>
              {SCENARIOS.map((scenario) => (
                <th
                  key={scenario}
                  scope="col"
                  style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}
                >
                  {scenarioTokens[SCENARIO_TOKEN_KEY[scenario]].labelDe}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OUTCOME_DIMENSIONS.map((dimension) => (
              <tr key={dimension}>
                <th scope="row" style={{ textAlign: "left", padding: "0.4rem 0.6rem", fontWeight: 600, borderBottom: "1px solid var(--surface-1)" }}>
                  {DIMENSION_LABEL_DE[dimension]}
                </th>
                {SCENARIOS.map((scenario) => {
                  const row = byDimensionScenario.get(`${dimension}:${scenario}`);
                  return (
                    <td key={scenario} className="tabular-nums" style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                      {!row || row.outcome.status === "not_modelled" ? (
                        <NotModelledBadge />
                      ) : (
                        <>
                          {formatValue(row.outcome.value ?? 0, row.outcome.unit)}
                          {row.delta && (
                            <span style={{ color: "var(--text-secondary)" }}>
                              {" "}
                              ({row.delta.delta >= 0 ? "+" : ""}
                              {row.delta.delta})
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
