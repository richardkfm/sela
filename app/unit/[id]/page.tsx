// Parcel detail (roadmap §5.1) — flow F2: per technology, a verdict and
// immediately *why* (the single criterion limiting or excluding it), above
// the fold. Phase 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { notFound } from "next/navigation";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { getCriterionDefinition } from "@/lib/db/queries/criteria";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { scenarioTokens, scenarioTokenCssVar, technologyToTokenKey } from "@/lib/design/tokens";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import type { SuitabilityVerdict, Technology } from "@/lib/scoring/types";

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

  const verdicts = await listVerdictsForUnit(id, CURRENT_METHOD_VERSION);

  return (
    <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <IllustrativeBanner />
      <div>
        <Link href="/">← Zur Karte</Link>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>
          Fläche <span className="tabular-nums">{id.slice(0, 8)}</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          {unit.pilotRegion} · {unit.kind === "hex_grid" ? "Rastereinheit" : "Flurstück"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {verdicts.length === 0 ? (
          <p>Für diese Fläche liegen noch keine Eignungsverdikte vor.</p>
        ) : (
          verdicts.map((verdict) => <VerdictRow key={verdict.technology} verdict={verdict} />)
        )}
      </div>

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
