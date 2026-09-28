// Parcel detail (roadmap §5.1) — flow F2: per technology, a verdict and
// immediately *why* (the criterion excluding it, the land-cover class that
// places it outside what is scored, or the criterion limiting it clearly
// against the rest of the region), above the fold; then the Prüfhinweise and
// every measured value. Real regions are classified without a score
// (real-pv-v1); the fixture keeps its illustrative score — see MethodNote.

import Link from "next/link";
import { notFound } from "next/navigation";
import { MethodNote } from "@/components/MethodNote";
import { ConfidenceMark } from "@/components/ConfidenceMark";
import { SourceAttribution } from "@/components/SourceAttribution";
import {
  getCriterionDefinition,
  getSource,
  listCriterionValuesForUnit,
  type CriterionDefinitionRow,
  type SourceRow,
} from "@/lib/db/queries/criteria";
import { listHabitatOverlapsForUnits, regionHasHabitatData } from "@/lib/db/queries/habitat";
import { listProtectionOverlapsForUnit } from "@/lib/db/queries/protection";
import { HabitatFacts } from "@/components/HabitatFacts";
import { habitatFacts } from "@/lib/scoring/habitat";
import { formatShareDe, protectionFlags, type ProtectionFlag } from "@/lib/scoring/protection-flags";
import {
  IRRADIATION_NOTE_DE,
  PROTECTION_EXCLUSION_SHARE,
  SLOPE_NOTE_DE,
  irradiationNationalPositionDe,
} from "@/lib/scoring/pv-rules";
import {
  LIMITING_EXPLANATION_DE,
  NO_LIMITING_CRITERION_DE,
  REASON_LEAD_DE,
  VERDICT_LABEL_DE,
  isClassified,
  isMeasuredOnly,
  readLandCover,
  type LandCoverReading,
} from "@/lib/scoring/verdict-text";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { formatCriterionValue } from "@/lib/scoring/format-value";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { scenarioTokens, scenarioTokenCssVar, technologyToTokenKey } from "@/lib/design/tokens";
import { TECHNOLOGY_LABEL_DE, appliesToLabel } from "@/lib/scoring/labels";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES, type CriterionValue, type SuitabilityVerdict } from "@/lib/scoring/types";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

function VerdictRow({
  verdict,
  reason,
  landCover,
}: {
  verdict: SuitabilityVerdict;
  reason: CriterionDefinitionRow | null;
  landCover: LandCoverReading | null;
}) {
  const tokenKey = technologyToTokenKey[verdict.technology];
  const token = scenarioTokens[tokenKey];
  const scored = verdict.verdict === "suitable" || verdict.verdict === "unsuitable";

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
            {REASON_LEAD_DE[verdict.verdict]}: <Link href={`/criterion/${reason.id}`}>{reason.nameDe}</Link>
            {reason.isCategory && landCover && (
              <>
                {" "}
                – {landCover.classDe} ({landCover.reasonDe})
              </>
            )}
          </div>
        )}
        {scored && !reason && (
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{NO_LIMITING_CRITERION_DE}</div>
        )}
        {scored && landCover?.tier === "eingeschraenkt" && (
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Bodenbedeckung <strong style={{ fontWeight: 600 }}>eingeschränkt</strong>: {landCover.classDe} – {landCover.reasonDe}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Stufen je Kriterium" (roadmap Step 2, decided 2026-09-28): each criterion in
 * its own class, side by side, never combined into a score. The reader sees
 * which rule placed the cell and what the measured values are.
 */
function CriterionClasses({
  values,
  landCover,
  strictShare,
  flagCount,
}: {
  values: readonly CriterionValue[];
  landCover: LandCoverReading | null;
  strictShare: number | undefined;
  flagCount: number;
}) {
  const irradiation = values.find((v) => v.criterionId === "pv_irradiation_annual");
  const slope = values.find((v) => v.criterionId === "pv_slope");
  const rows: { label: string; href: string; value: string; note: string }[] = [
    {
      label: "Schutzgebiete",
      href: "/criterion/pv_protection_status",
      value:
        strictShare === undefined
          ? "nicht geprüft"
          : strictShare >= PROTECTION_EXCLUSION_SHARE
            ? "ausgeschlossen"
            : "kein Ausschluss",
      note:
        strictShare === undefined
          ? ""
          : `${formatShareDe(strictShare)} der Fläche in Naturschutzgebiet oder Nationalpark; ausgeschlossen ab ${formatShareDe(PROTECTION_EXCLUSION_SHARE)}. ` +
            (flagCount > 0 ? `${flagCount} Prüfhinweis${flagCount === 1 ? "" : "e"} unten.` : "Keine Prüfhinweise."),
    },
    {
      label: "Bodenbedeckung",
      href: "/criterion/pv_land_cover",
      value: landCover ? landCover.classLabelDe : "kein Wert",
      note: landCover ? `${landCover.classDe} – ${landCover.reasonDe}` : "",
    },
    {
      label: "Globalstrahlung",
      href: "/criterion/pv_irradiation_annual",
      value: irradiation ? irradiationNationalPositionDe(irradiation.value) : "kein Wert",
      note: irradiation
        ? `${formatCriterionValue(irradiation.criterionId, irradiation.value, irradiation.unit)}. ${IRRADIATION_NOTE_DE}`
        : "",
    },
    {
      label: "Geländeneigung",
      href: "/criterion/pv_slope",
      value: slope ? formatCriterionValue(slope.criterionId, slope.value, slope.unit) : "kein Wert",
      note: SLOPE_NOTE_DE,
    },
  ];
  return (
    <section aria-labelledby="classes-heading" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <h2 id="classes-heading" style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
        Einordnung je Kriterium · Freiflächen- und Agri-PV
      </h2>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
        Jedes Kriterium für sich, nicht zu einer Punktzahl verrechnet. Die Einordnung oben folgt aus Schutzgebiet und
        Bodenbedeckung.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              {["Kriterium", "Stufe bzw. Wert", "Erläuterung"].map((label) => (
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
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" style={{ textAlign: "left", fontWeight: 400, padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)", verticalAlign: "top" }}>
                  <Link href={row.href}>{row.label}</Link>
                </th>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)", fontWeight: 600, verticalAlign: "top" }}>
                  {row.value}
                </td>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)", color: "var(--text-secondary)", fontSize: "0.85rem", verticalAlign: "top" }}>
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Prüfhinweise (decision memo Q1c, Q2d; ADR-0009): protected areas that do not
 * exclude the cell, named with their share and the duty the statute sets. A
 * neutral note, not a warning colour — it is a condition to check, not a verdict.
 */
function ProtectionFlags({ flags, source }: { flags: readonly ProtectionFlag[]; source: SourceRow | null }) {
  return (
    <section aria-labelledby="flags-heading" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <h2 id="flags-heading" style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
        Prüfhinweise zu Schutzgebieten · Freiflächen- und Agri-PV
      </h2>
      {flags.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Nach den Übersichtsdaten des LfU überschneidet sich diese Fläche mit keinem FFH-, Vogelschutz- oder
          Landschaftsschutzgebiet und nur zu weniger als der Hälfte bzw. gar nicht mit einem Naturschutzgebiet
          (Überschneidungen unter 1 % der Fläche nicht gezählt).
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {flags.map((flag) => (
            <li
              key={`${flag.category}-${flag.areaCode}-${flag.name}`}
              className="flag-note"
            >
              <span aria-hidden className="flag-glyph">§</span>
              <span>{flag.textDe}</span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
        Die Schutzgebietsgrenzen sind Übersichtsdaten (digitalisiert im Maßstab 1:10 000, nicht rechtsverbindlich).
        Ein Hinweis ersetzt keine Prüfung durch die zuständige Behörde. Quelle:{" "}
        {source ? <SourceAttribution source={source} /> : "LfU Brandenburg"}
      </p>
    </section>
  );
}

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getSpatialUnitById(id);
  if (!unit) notFound();

  const [verdicts, values, overlaps, habitat, hasHabitatData, habitatSource] = await Promise.all([
    listVerdictsForUnit(id, CURRENT_METHOD_VERSION),
    listCriterionValuesForUnit(id),
    listProtectionOverlapsForUnit(id),
    listHabitatOverlapsForUnits([id]),
    regionHasHabitatData(unit.pilotRegion),
    getSource("lfu-bb-biotopkataster"),
  ]);
  const reasons = new Map(
    await Promise.all(
      verdicts.map(async (v) => {
        const reasonId = v.excludedByCriterionId ?? v.limitingCriterionId;
        return [v.technology, reasonId ? await getCriterionDefinition(reasonId) : null] as const;
      }),
    ),
  );
  const landCoverValue = values.find((v) => v.criterionId === "pv_land_cover");
  const landCover = landCoverValue ? readLandCover(landCoverValue.value) : null;
  const strictShare = values.find((v) => v.criterionId === "pv_protection_status")?.value;
  const flags = strictShare === undefined ? null : protectionFlags(overlaps, strictShare);
  const flagSource = flags ? await getSource("lfu-bb-schutzgebiete") : null;
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
      <MethodNote kind={region.kind} />
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
          verdicts.map((verdict) => (
            <VerdictRow
              key={verdict.technology}
              verdict={verdict}
              reason={reasons.get(verdict.technology) ?? null}
              landCover={landCover}
            />
          ))
        )}
        {verdicts.length > 0 &&
          TECHNOLOGIES.filter((t) => !verdicts.some((v) => v.technology === t)).map((technology) => (
            <p key={technology} style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {TECHNOLOGY_LABEL_DE[technology]}: nicht bewertet – für diese Technologie liegt hier kein
              bewertbares Kriterium vor{technology === "wind" ? " (für die Windressource ist noch keine Quelle festgelegt)" : ""}.
            </p>
          ))}
      </div>

      {verdicts.some((v) => v.limitingCriterionId) && (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          „Begrenzt am deutlichsten durch“ nennt {LIMITING_EXPLANATION_DE}.
        </p>
      )}

      {region.kind === "real" && verdicts.some((v) => isClassified(v.verdict)) && (
        <CriterionClasses values={values} landCover={landCover} strictShare={strictShare} flagCount={flags?.length ?? 0} />
      )}

      {flags && <ProtectionFlags flags={flags} source={flagSource} />}

      {region.kind === "real" && (
        <HabitatFacts facts={habitatFacts(habitat)} source={habitatSource} hasData={hasHabitatData} />
      )}

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
                        {definition?.isHardConstraint ? "Ausschlusskriterium · " : ""}
                        {definition?.isCategory ? "Kategorie · " : ""}
                        {definition && isMeasuredOnly(definition) ? "Messwert, nicht verrechnet · " : ""}gilt für{" "}
                        {(definition?.appliesTo ?? []).map(appliesToLabel).join(", ")}
                      </span>
                    </th>
                    <td className="tabular-nums" style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                      {formatCriterionValue(value.criterionId, value.value, value.unit)}
                      {value.criterionId === "pv_irradiation_annual" && (
                        <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {irradiationNationalPositionDe(value.value)}
                        </span>
                      )}
                      {value.criterionId === "pv_land_cover" && (
                        <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                          Einordnung: {readLandCover(value.value).classLabelDe}
                        </span>
                      )}
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
