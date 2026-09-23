// Parcel detail (roadmap §5.1) — flow F2: per technology, a verdict and
// immediately *why* (the single criterion limiting or excluding it), above
// the fold. Phase 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { notFound } from "next/navigation";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { ConfidenceMark } from "@/components/ConfidenceMark";
import { SourceAttribution } from "@/components/SourceAttribution";
import { getCriterionDefinition, getSource, listCriterionValuesForUnit } from "@/lib/db/queries/criteria";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { formatCriterionValue } from "@/lib/scoring/format-value";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { scenarioTokens, scenarioTokenCssVar, technologyToTokenKey } from "@/lib/design/tokens";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES, type SuitabilityVerdict, type Technology } from "@/lib/scoring/types";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const TECHNOLOGY_LABEL_DE: Record<Technology, string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

const VERDICT_LABEL_DE: Record<SuitabilityVerdict["verdict"], string> = {
  suitable: "geeignet",
  unsuitable: "ungeeignet",
  excluded: "ausgeschlossen",
};

async function VerdictRow({ verdict }: { verdict: SuitabilityVerdict }) {
  const reasonId = verdict.excludedByCriterionId ?? verdict.limitingCriterionId;
  const reason = reasonId ? await getCriterionDefinition(reasonId) : null;
  const tokenKey = technologyToTokenKey[verdict.technology];
  const token = scenarioTokens[tokenKey];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        border: "1px solid var(--surface-1)",
        borderRadius: "0.5rem",
      }}
    >
      <span
        aria-hidden
        className={token.secondaryEncoding !== "none" ? `pattern-${token.secondaryEncoding}` : undefined}
        style={{
          width: "1.1rem",
          height: "1.1rem",
          borderRadius: "0.25rem",
          backgroundColor: `var(${scenarioTokenCssVar[tokenKey]})`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>
          {TECHNOLOGY_LABEL_DE[verdict.technology]}: {VERDICT_LABEL_DE[verdict.verdict]}
          {verdict.score !== null && (
            <span className="tabular-nums" style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
              {" "}
              (Punktzahl {verdict.score.toFixed(2)})
            </span>
          )}
        </div>
        {reason && (
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {verdict.verdict === "excluded" ? "Ausgeschlossen durch: " : "Begrenzender Faktor: "}
            <Link href={`/criterion/${reason.id}`}>{reason.nameDe}</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) notFound();

  const [verdicts, values] = await Promise.all([
    listVerdictsForUnit(id, CURRENT_METHOD_VERSION),
    listCriterionValuesForUnit(id),
  ]);
  const region = pilotRegionInfo(unit.pilotRegion);
  // Every value behind the verdicts, with its criterion, confidence and source
  // — CLAUDE.md §4.1: a headline must decompose into named, sourced criteria
  // on screen, not only in the database.
  const measured = await Promise.all(
    values.map(async (value) => ({
      value,
      definition: await getCriterionDefinition(value.criterionId),
      source: await getSource(value.sourceId),
    })),
  );
  measured.sort((a, b) => (a.definition?.nameDe ?? "").localeCompare(b.definition?.nameDe ?? "", "de"));

  return (
    <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <IllustrativeBanner kind={region.kind} />
      <div>
        <Link href="/">← Zur Karte</Link>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>
          Fläche <span className="tabular-nums">{id.slice(0, 8)}</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          {region.nameDe} · {unit.kind === "hex_grid" ? "Rastereinheit" : "Flurstück"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {verdicts.length === 0 ? (
          <p>Für diese Fläche liegen noch keine Eignungsverdikte vor.</p>
        ) : (
          verdicts.map((verdict) => <VerdictRow key={verdict.technology} verdict={verdict} />)
        )}
        {verdicts.length > 0 &&
          TECHNOLOGIES.filter((t) => !verdicts.some((v) => v.technology === t)).map((technology) => (
            <p key={technology} style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {TECHNOLOGY_LABEL_DE[technology]}: nicht bewertet – für diese Technologie liegt hier kein
              bewertbares Kriterium vor{technology === "wind" ? " (für die Windressource ist noch keine Quelle festgelegt)" : ""}.
            </p>
          ))}
      </div>

      {measured.length > 0 && (
        <section aria-labelledby="measured-heading" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h2 id="measured-heading" style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
            Messwerte dieser Fläche
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  {["Kriterium", "Wert", "Konfidenz", "Quelle"].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measured.map(({ value, definition, source }) => (
                  <tr key={value.criterionId}>
                    <th scope="row" style={{ textAlign: "left", fontWeight: 400, padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                      <Link href={`/criterion/${value.criterionId}`}>{definition?.nameDe ?? value.criterionId}</Link>
                      <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {definition?.isHardConstraint ? "Ausschlusskriterium · " : ""}gilt für{" "}
                        {(definition?.appliesTo ?? []).map((t) => TECHNOLOGY_LABEL_DE[t as Technology] ?? t).join(", ")}
                      </span>
                    </th>
                    <td className="tabular-nums" style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                      {formatCriterionValue(value.criterionId, value.value, value.unit)}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                      <ConfidenceMark confidence={value.confidence} />
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)", fontSize: "0.8rem" }}>
                      {source ? <SourceAttribution source={source} /> : value.sourceId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Link
        href={`/unit/${id}/compare`}
        style={{
          alignSelf: "flex-start",
          padding: "0.6rem 1rem",
          borderRadius: "0.4rem",
          background: "var(--text-primary)",
          color: "var(--ground)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Szenarien vergleichen →
      </Link>
    </main>
  );
}
