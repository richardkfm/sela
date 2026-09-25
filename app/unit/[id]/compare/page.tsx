// Scenario comparison (roadmap §5.1) — the centrepiece: all scenarios on
// identical outcome dimensions, deltas against status_quo, always with a
// reachable table view (design-language.md §9: a table view reachable from
// every chart). Two kinds of rows share the table: the illustrative
// placeholders (IllustrativeBanner) and the cited outcome methods of
// ADR-0008, whose every number reaches its inputs and sources below the table.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfidenceMark } from "@/components/ConfidenceMark";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { NotApplicableBadge } from "@/components/NotApplicableBadge";
import { NotModelledBadge } from "@/components/NotModelledBadge";
import { SourceAttribution } from "@/components/SourceAttribution";
import { listCriterionDefinitions, listSources } from "@/lib/db/queries/criteria";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listOutcomeInputsForUnit, listOutcomesForUnit, type OutcomeInputRow } from "@/lib/db/queries/outcomes";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { scenarioTokenCssVar, scenarioTokens } from "@/lib/design/tokens";
import { formatCriterionValue } from "@/lib/scoring/format-value";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import {
  DIMENSION_LABEL_DE,
  buildComparisonLines,
  comparisonMethodVersions,
  type OutcomeCell,
} from "@/lib/scoring/outcome-display";
import { SCENARIOS, type Scenario } from "@/lib/scoring/types";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const CELL_STYLE = { padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)", verticalAlign: "top" } as const;

function Cell({ cell }: { cell: OutcomeCell }) {
  if (cell.kind === "not_modelled") return <NotModelledBadge />;
  if (cell.kind === "not_applicable") return <NotApplicableBadge reasonDe={cell.reasonDe} />;
  return (
    <>
      <span style={{ whiteSpace: "nowrap" }}>{cell.valueText}</span> <ConfidenceMark confidence={cell.confidence} compact />
      {cell.centralText && (
        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{cell.centralText}</span>
      )}
      {cell.deltaText && (
        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{cell.deltaText}</span>
      )}
    </>
  );
}

const SCENARIO_TOKEN_KEY: Record<Scenario, keyof typeof scenarioTokens> = {
  status_quo: "statusQuo",
  develop_pv: "solarPv",
  develop_agripv: "agriPv",
  develop_wind: "onshoreWind",
  preserve: "preserve",
  restore: "restore",
};

export default async function CompareScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) notFound();

  const versions = comparisonMethodVersions(CURRENT_METHOD_VERSION);
  const [rows, inputs, definitions, sources] = await Promise.all([
    listOutcomesForUnit(id, versions),
    listOutcomeInputsForUnit(id, versions),
    listCriterionDefinitions(),
    listSources(),
  ]);
  const region = pilotRegionInfo(unit.pilotRegion);
  const lines = buildComparisonLines(rows.map((r) => r.outcome));
  const citedLines = lines.filter((l) => l.methodVersion !== null);
  const showsIllustrative = region.kind === "fixture" || lines.some((l) => l.methodVersion === null && SCENARIOS.some((s) => l.cells[s].kind !== "not_modelled"));

  // The energy chart only earns its place when some scenario has energy
  // output; an empty chart would read as "no energy", which is not what
  // "not modelled" says.
  const energyRows = rows.filter((r) => r.dimension === "energy" && r.outcome.status === "modelled");
  const energyByScenario = new Map(energyRows.map((r) => [r.scenario, r.outcome.value ?? 0]));
  const energyMax = Math.max(1, ...energyByScenario.values());

  return (
    <main style={{ padding: "1.5rem", maxWidth: "64rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {showsIllustrative && <IllustrativeBanner kind={region.kind} />}
      {citedLines.length > 0 && <CitedMethodsNote othersNotModelled={!showsIllustrative} />}
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
      {energyRows.length > 0 && (
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
          const value = energyByScenario.get(scenario) ?? 0;
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
      )}

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
            Alle Werte gegenüber dem Ist-Zustand (Δ). Konfidenz: ● hoch, ◐ mittel, ○ niedrig. Ein Bereich wird
            als Bereich gezeigt; was er bedeutet, steht bei der <Link href="/method#ergebnis-methoden">Methode</Link>.
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
            {lines.map((line) => (
              <tr key={`${line.dimension}/${line.metric}`}>
                <th scope="row" style={{ ...CELL_STYLE, textAlign: "left", fontWeight: 600 }}>
                  {line.metricLabelDe ? (
                    <>
                      <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 400, color: "var(--text-secondary)" }}>
                        {DIMENSION_LABEL_DE[line.dimension]}
                      </span>
                      {line.metricLabelDe}
                    </>
                  ) : (
                    DIMENSION_LABEL_DE[line.dimension]
                  )}
                </th>
                {SCENARIOS.map((scenario) => (
                  <td key={scenario} className="tabular-nums" style={CELL_STYLE}>
                    <Cell cell={line.cells[scenario]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {citedLines.length > 0 && (
        <Provenance
          lines={citedLines.map((l) => ({ methodVersion: l.methodVersion!, metric: l.metric, labelDe: l.metricLabelDe! }))}
          inputs={inputs}
          definitionNames={new Map(definitions.map((d) => [d.id, d.nameDe]))}
          sources={new Map(sources.map((s) => [s.id, s]))}
        />
      )}
    </main>
  );
}

function CitedMethodsNote({ othersNotModelled }: { othersNotModelled: boolean }) {
  return (
    <div
      role="note"
      style={{
        border: "1px solid var(--text-secondary)",
        borderRadius: "0.4rem",
        padding: "0.6rem 0.9rem",
        fontSize: "0.85rem",
        color: "var(--text-secondary)",
        background: "var(--surface-1)",
      }}
    >
      Klima- und Wasserwerte folgen zitierten Methoden (siehe{" "}
      <Link href="/method#ergebnis-methoden">Methode</Link>)
      {othersNotModelled ? "; die übrigen Dimensionen sind noch nicht modelliert." : "."} sela ersetzt keine
      Planungsentscheidung.
    </div>
  );
}

/**
 * "Woher kommen diese Zahlen?" — every cited metric on screen, its method,
 * and the criterion values it was computed from with their sources
 * (CLAUDE.md §4.1; ADR-0008 §4: outcome → input → criterion value → source).
 * Lists, not a table: the comparison table stays the page's one table.
 */
function Provenance({
  lines,
  inputs,
  definitionNames,
  sources,
}: {
  lines: readonly { methodVersion: string; metric: string; labelDe: string }[];
  inputs: readonly OutcomeInputRow[];
  definitionNames: ReadonlyMap<string, string>;
  sources: ReadonlyMap<string, Parameters<typeof SourceAttribution>[0]["source"]>;
}) {
  const methodByVersion = new Map(CITED_OUTCOME_METHODS.map((c) => [c.method.methodVersion, c.method]));
  return (
    <section aria-labelledby="provenance-heading" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h2 id="provenance-heading" style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
        Woher kommen diese Zahlen?
      </h2>
      {lines.map((line) => {
        const method = methodByVersion.get(line.methodVersion)!;
        const info = method.metrics.find((m) => m.metric === line.metric);
        // The same criterion value feeds several scenarios; list it once.
        const used = new Map(
          inputs
            .filter((i) => i.methodVersion === line.methodVersion && i.metric === line.metric)
            .map((i) => [i.criterionValueId, i]),
        );
        return (
          <div key={`${line.methodVersion}/${line.metric}`} style={{ fontSize: "0.9rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>{line.labelDe}</h3>
            <p style={{ margin: "0.2rem 0", color: "var(--text-secondary)" }}>
              Methode: <Link href={`/method#${line.methodVersion}`}>{method.nameDe}</Link>{" "}
              (<span className="tabular-nums">{line.methodVersion}</span>)
              {info?.rangeDe && <> · Bereich: {info.rangeDe}</>}
            </p>
            {used.size === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>Für diese Fläche ohne Eingangswerte.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {[...used.values()].map((input) => {
                  const source = sources.get(input.sourceId);
                  return (
                    <li key={input.criterionValueId}>
                      <Link href={`/criterion/${input.criterionId}`}>{definitionNames.get(input.criterionId) ?? input.criterionId}</Link>
                      : <span className="tabular-nums">{formatCriterionValue(input.criterionId, input.value, input.unit)}</span>{" "}
                      <ConfidenceMark confidence={input.confidence} compact /> ·{" "}
                      <span style={{ fontSize: "0.8rem" }}>{source ? <SourceAttribution source={source} /> : input.sourceId}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
