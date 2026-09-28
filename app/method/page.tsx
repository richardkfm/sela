// Method page — how sela scores, in public, with weights and sources
// listed (mvp.md §7). Rendered from live criterion_definition/source rows,
// so it cannot drift from the scoring code in effect (roadmap §5.1). Phase
// 3 (0.3.0) fixture data — see MethodNote.

import Link from "next/link";
import { MethodNote } from "@/components/MethodNote";
import { listCriterionDefinitions, listSources } from "@/lib/db/queries/criteria";
import { listOutcomeMethods, type OutcomeMethodRow } from "@/lib/db/queries/outcomes";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import { scenarioToTokenKey, scenarioTokens } from "@/lib/design/tokens";
import { HABITAT_CAVEAT_DE, HABITAT_MIN_SHARE, LRT_GRADE_DE } from "@/lib/scoring/habitat";
import type { Scenario } from "@/lib/scoring/types";
import type { CitedFactor, OutcomeMethod } from "@/lib/scoring/nature/method";
import { DIMENSION_LABEL_DE } from "@/lib/scoring/outcome-display";
import { TECHNOLOGIES } from "@/lib/scoring/types";
import { appliesToLabel } from "@/lib/scoring/labels";
import { isMeasuredOnly } from "@/lib/scoring/verdict-text";
import {
  IRRADIATION_NATIONAL_QUARTILES,
  LAND_COVER_TIER_LABEL_DE,
  PROTECTION_EXCLUSION_SHARE,
  PROTECTION_FLAG_MIN_SHARE,
  landCoverClassesOfTier,
  type LandCoverTier,
} from "@/lib/scoring/pv-rules";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

export default async function MethodPage() {
  const citedVersions = CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion);
  const [allDefinitions, sources, storedMethods] = await Promise.all([
    listCriterionDefinitions(),
    listSources(),
    listOutcomeMethods(citedVersions),
  ]);
  const storedByVersion = new Map(storedMethods.map((m) => [m.methodVersion, m]));
  // Only the criteria the suitability engine weighs. Inputs to outcome methods
  // (ADR-0008) carry no weight, and a "0" in this column would misstate them;
  // they are presented with their methods instead.
  const definitions = allDefinitions.filter((d) => d.appliesTo.some((t) => (TECHNOLOGIES as readonly string[]).includes(t)));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return (
    <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <MethodNote kind={definitions.some((d) => !d.id.startsWith("fixture_")) ? "real" : "fixture"} />
      <div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>Methode</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Diese Seite listet exakt die <code>criterion_definition</code>-Zeilen, die die
          Bewertungs-Engine (<code>lib/scoring/</code>, Methodenversion{" "}
          <span className="tabular-nums">{CURRENT_METHOD_VERSION}</span>) tatsächlich liest — sie kann
          daher nicht vom aktiven Code abweichen. Kriterien mit dem Präfix <code>fixture_</code> gehören
          zum synthetischen Beispieldatensatz und tragen eine willkürliche Beispiel-Gewichtung. Alle
          anderen lesen echte Messwerte der Pilotregion Uckermark und werden nicht gewichtet, sondern nach
          den unten beschriebenen Regeln eingeordnet (Methode <code>real-pv-v1</code>, siehe{" "}
          <code>docs/domain/scoring-criteria.md</code>).
        </p>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}>
              Kriterium
            </th>
            <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}>
              Gilt für
            </th>
            <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}>
              Gewichtung
            </th>
            <th scope="col" style={{ textAlign: "left", padding: "0.4rem 0.6rem", borderBottom: "2px solid var(--text-secondary)" }}>
              Quelle
            </th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((definition) => {
            const source = sourceById.get(definition.sourceId);
            return (
              <tr key={definition.id}>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                  <Link href={`/criterion/${definition.id}`}>{definition.nameDe}</Link>
                  {definition.isHardConstraint && (
                    <span style={{ color: "var(--text-secondary)" }}> (Ausschlusskriterium)</span>
                  )}
                </td>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                  {definition.appliesTo.map(appliesToLabel).join(", ")}
                </td>
                <td className="tabular-nums" style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                  {definition.isCategory
                    ? "Kategorie"
                    : isMeasuredOnly(definition)
                      ? "Messwert, nicht verrechnet"
                      : definition.isHardConstraint && !definition.id.startsWith("fixture_")
                        ? "Ausschluss"
                        : definition.weight}
                </td>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                  {source?.dataset ?? definition.sourceId}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <PvRulesSection />

      <section aria-labelledby="ergebnis-methoden" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 id="ergebnis-methoden" style={{ fontSize: "1.2rem", fontWeight: 600, margin: "1rem 0 0" }}>
          Wie die Ergebnisse berechnet werden
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Was eine neue PV-Anlage gewinnt, was erhalten bleibt und was eine Renaturierung verbessert, rechnet sela nach
          veröffentlichten Methoden, nicht mit Gewichten. Jede Methode unten nennt ihre Quelle und jeden Faktor, den sie verwendet; jede Zahl
          im Szenarienvergleich führt über ihre Eingangswerte zu deren Quelle. Wo eine Methode einen Bereich
          ausgibt, zeigt sela den Bereich, nicht nur einen Mittelwert.
        </p>
        {CITED_OUTCOME_METHODS.map(({ method }) => (
          <OutcomeMethodSection key={method.methodVersion} method={method} stored={storedByVersion.get(method.methodVersion)} />
        ))}
      </section>

      <section aria-labelledby="naturkapital" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
        <h2 id="naturkapital" style={{ fontSize: "1.2rem", fontWeight: 600, margin: "1rem 0 0" }}>
          Naturkapital: Kategorien, keine Punktzahl
        </h2>
        <p style={{ margin: 0 }}>
          Für den Wert eines Biotops gibt es in Brandenburg keine Punkteskala, die sela zitieren könnte. sela zeigt
          deshalb, was das Biotopkataster des LfU auf einer Fläche verzeichnet: Biotoptyp, ob es dort als geschütztes
          Biotop (§ 30 BNatSchG i. V. m. § 18 BbgNatSchAG) erfasst ist, FFH-Lebensraumtyp und dessen Erhaltungsgrad (
          {Object.entries(LRT_GRADE_DE)
            .filter(([code]) => ["A", "B", "C"].includes(code))
            .map(([code, label]) => `${code} ${label}`)
            .join(", ")}
          ). Flächenbiotope unter {PCT.format(HABITAT_MIN_SHARE * 100)} % einer Zelle werden nicht aufgeführt. Nichts
          davon wird verrechnet, summiert oder in die Einordnung für PV übernommen.
        </p>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>{HABITAT_CAVEAT_DE}</p>
      </section>

      <section aria-labelledby="mehrere-zellen" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
        <h2 id="mehrere-zellen" style={{ fontSize: "1.2rem", fontWeight: 600, margin: "1rem 0 0" }}>
          Mehrere Zellen als eine Fläche
        </h2>
        <p style={{ margin: 0 }}>
          Wer mehrere Zellen zusammenfasst, sieht Zählungen und Summen der einzelnen Zellen, keine neue Bewertung: je
          Klasse die Zahl der Zellen, je Schutzgebiet und Biotop die Zahl der berührten Zellen. Größen je Hektar
          (Kohlenstoffvorrat, Treibhausgasbilanz, Leistung, Ertrag) werden über die Flächen summiert, Zustände
          (Versickerung, Bodenfeuchte) flächengewichtet gemittelt – jeweils nur über die Zellen, für die die Methode
          einen Wert hat, und die Seite sagt, über wie viele. Bereiche werden Grenze für Grenze addiert. Eine Änderung
          gegenüber dem Ist-Zustand wird nur genannt, wo beide Summen dieselben Zellen umfassen.
        </p>
      </section>
    </main>
  );
}

const TIERS: readonly LandCoverTier[] = ["vorgesehen", "eingeschraenkt", "nicht_vorgesehen"];
const TIER_EFFECT_DE: Record<LandCoverTier, string> = {
  vorgesehen: "Einordnung „ohne Einschränkung“",
  eingeschraenkt: "Einordnung „eingeschränkt“",
  nicht_vorgesehen: "Einordnung „nicht vorgesehen“",
};
const KWH = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

/**
 * The rules the project owner decided on 2026-09-27 (roadmap Step 1,
 * docs/domain/decision-memo-scoring-rules.md), rendered from the same module
 * the engine reads (lib/scoring/pv-rules.ts), so the page cannot drift from it.
 */
function PvRulesSection() {
  return (
    <section aria-labelledby="pv-regeln" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9rem" }}>
      <h2 id="pv-regeln" style={{ fontSize: "1.2rem", fontWeight: 600, margin: "1rem 0 0" }}>
        Wie Flächen für Freiflächen- und Agri-PV eingeordnet werden
      </h2>
      <p style={{ color: "var(--text-secondary)", margin: 0 }}>
        Methode <code>real-pv-v1</code>, entschieden am 27. und 28.09.2026. Es gibt keine Punktzahl und kein
        „geeignet“: Für eine Gewichtung von Strahlung und Neigung und für eine Eignungsschwelle fand sich keine
        belastbare Quelle, und mit plausiblen Annahmen wären zwischen 0 % und 100 % der Flächen „ungeeignet“
        gewesen. Jedes Kriterium wird deshalb für sich eingeordnet. Die Einordnung ist beratend – keine Planungs-,
        Eignungs- oder Genehmigungsaussage.
      </p>

      <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0.5rem 0 0" }}>In dieser Reihenfolge</h3>
      <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <li>
          <strong>Ausgeschlossen</strong>, wenn mindestens {PCT.format(PROTECTION_EXCLUSION_SHARE * 100)} % der Fläche nach
          den Übersichtsdaten des LfU in einem Naturschutzgebiet oder dem Nationalpark liegen – dort verbietet das Gesetz
          nach Maßgabe der Verordnung Veränderungen (§§ 23, 24 BNatSchG).
        </li>
        <li>
          <strong>Nicht vorgesehen</strong>, wenn die vorherrschende Bodenbedeckung in der Stufe „nicht vorgesehen“ liegt
          (Tabelle unten). Das ist selas eigene Einordnung, keine Rechtsfolge.
        </li>
        <li>
          Sonst <strong>eingeschränkt</strong> oder <strong>ohne Einschränkung</strong>, je nach der Stufe der
          Bodenbedeckung. „Ohne Einschränkung“ heißt: keiner der geprüften Gründe spricht dagegen – nicht, dass die
          Fläche geeignet, geplant oder genehmigungsfähig wäre.
        </li>
      </ol>

      <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0.5rem 0 0" }}>Gezeigt, aber nicht verrechnet</h3>
      <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <li>
          <strong>Globalstrahlung</strong>, eingestuft nach Vierteln der Werte in Deutschland (DWD-Mittel 2016–2025 aller
          Rasterzellen; Grenzen {KWH.format(IRRADIATION_NATIONAL_QUARTILES.p25)},{" "}
          {KWH.format(IRRADIATION_NATIONAL_QUARTILES.p50)} und {KWH.format(IRRADIATION_NATIONAL_QUARTILES.p75)} kWh/m²·a).
          Die ganze Uckermark liegt im unteren Mittelfeld; innerhalb der Region unterscheidet die Strahlung Flächen kaum.
          Ihre eigentliche Aufgabe ist der Energieertrag (unten, <code>pv-yield-v1</code>).
        </li>
        <li>
          <strong>Geländeneigung</strong>, nur als Messwert mit niedriger Konfidenz: Das 200-m-Geländemodell glättet
          Neigungen, und Brandenburg empfiehlt zwar, Hanglagen zu vermeiden, nennt aber keinen Grenzwert (Gemeinsame
          Arbeitshilfe PV-FFA, 2023, S. 21). Die steilste Uckermark-Fläche misst 6,8°.
        </li>
      </ul>

      <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0.5rem 0 0" }}>Prüfhinweise zu Schutzgebieten</h3>
      <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <li>FFH- und Europäische Vogelschutzgebiete: Verträglichkeitsprüfung erforderlich (§ 34 BNatSchG) – kein Ausschluss.</li>
        <li>Landschaftsschutzgebiete: was zulässig ist, regelt die Schutzgebietsverordnung (§ 26 BNatSchG) – kein Ausschluss.</li>
        <li>
          Naturschutzgebiet oder Nationalpark auf weniger als {PCT.format(PROTECTION_EXCLUSION_SHARE * 100)} % der Fläche: der
          Anteil wird genannt.
        </li>
        <li>
          Überschneidungen unter {PCT.format(PROTECTION_FLAG_MIN_SHARE * 100)} % der Fläche werden nicht angezeigt – sie liegen
          in der Digitalisiergenauigkeit der Übersichtsdaten (1:10 000). Biosphärenreservate werden noch nicht als Hinweis
          geführt.
        </li>
      </ul>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
          <caption style={{ textAlign: "left", captionSide: "top", fontWeight: 600, padding: "0.5rem 0" }}>
            Bodenbedeckung in drei Stufen (CORINE-Klassen nach CLC5)
          </caption>
          <thead>
            <tr>
              <th scope="col" style={TH}>Klasse</th>
              <th scope="col" style={TH}>Begründung</th>
            </tr>
          </thead>
          {TIERS.map((tier) => (
            <tbody key={tier}>
              <tr>
                <th scope="rowgroup" colSpan={2} style={{ ...TD, textAlign: "left", paddingTop: "0.6rem" }}>
                  {LAND_COVER_TIER_LABEL_DE[tier]} – {TIER_EFFECT_DE[tier]}
                </th>
              </tr>
              {landCoverClassesOfTier(tier).map((c) => (
                <tr key={c.code}>
                  <th scope="row" style={{ ...TD, fontWeight: 400, textAlign: "left" }}>
                    <span className="tabular-nums">{c.code}</span> · {c.nameDe}
                  </th>
                  <td style={TD}>{c.reasonDe}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

const TH = { textAlign: "left", padding: "0.3rem 0.5rem", borderBottom: "2px solid var(--text-secondary)" } as const;
const TD = { padding: "0.3rem 0.5rem", borderBottom: "1px solid var(--surface-1)", verticalAlign: "top" } as const;
const NUMBER_FORMAT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 });
const NUMBER = { format: (value: number) => NUMBER_FORMAT.format(value).replace("-", "−") };

function isCitedFactor(value: unknown): value is CitedFactor {
  return typeof value === "object" && value !== null && "value" in value && "citation" in value && "unit" in value;
}

/** The method's stored parameters, split into cited factors (a table) and stated settings (a list). */
function flattenParameters(parameters: Readonly<Record<string, unknown>>) {
  const factors: { path: string; factor: CitedFactor }[] = [];
  const settings: { path: string; text: string }[] = [];
  const walk = (value: unknown, path: string) => {
    if (isCitedFactor(value)) factors.push({ path, factor: value });
    else if (typeof value === "object" && value !== null) {
      for (const [key, inner] of Object.entries(value)) walk(inner, path ? `${path}.${key}` : key);
    } else settings.push({ path, text: typeof value === "number" ? NUMBER.format(value) : String(value) });
  };
  walk(parameters, "");
  return { factors, settings };
}

/**
 * One cited method, from its stored `outcome_method` row — the record of what
 * produced the numbers in this database. Metric names come from the code
 * that wrote the row.
 */
function OutcomeMethodSection({ method, stored }: { method: OutcomeMethod; stored: OutcomeMethodRow | undefined }) {
  const { factors, settings } = stored ? flattenParameters(stored.parameters) : { factors: [], settings: [] };
  return (
    <article
      id={method.methodVersion}
      aria-labelledby={`${method.methodVersion}-heading`}
      style={{ borderTop: "1px solid var(--surface-1)", paddingTop: "0.75rem", fontSize: "0.9rem" }}
    >
      <h3 id={`${method.methodVersion}-heading`} style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
        {stored?.nameDe ?? method.nameDe}
      </h3>
      <p style={{ margin: "0.2rem 0", color: "var(--text-secondary)" }}>
        {DIMENSION_LABEL_DE[method.dimension]} · Methodenversion <span className="tabular-nums">{method.methodVersion}</span>
      </p>
      {!stored ? (
        <p>Für diese Datenbank noch nicht berechnet — im Szenarienvergleich erscheint diese Methode daher nicht.</p>
      ) : (
        <>
          <p>{stored.descriptionDe}</p>
          <p style={{ color: "var(--text-secondary)" }}>Quelle: {stored.citation}</p>
        </>
      )}
      <ul style={{ paddingLeft: "1.2rem" }}>
        {method.metrics.map((m) => (
          <li key={m.metric}>
            <strong>{m.labelDe}</strong> ({m.unit})
            {m.notApplicableDe && <> · „Trifft nicht zu“, wenn: {m.notApplicableDe}</>}
            {m.notApplicableByScenarioDe && (
              <>
                {" "}· „Trifft nicht zu“:{" "}
                {Object.entries(m.notApplicableByScenarioDe)
                  .map(([scenario, reason]) => `${scenarioTokens[scenarioToTokenKey[scenario as Scenario]].labelDe} – ${reason}`)
                  .join("; ")}
              </>
            )}
            {" "}· mehrere Zellen: {m.siteAggregation === "sum_per_ha" ? "Summe über die Flächen" : "Flächenmittel"}
            {m.rangeDe && <> · Bereich: {m.rangeDe}</>}
          </li>
        ))}
      </ul>
      {stored && (
        <details>
          <summary>Alle Festlegungen und Faktoren dieser Methode</summary>
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(8rem, max-content) 1fr", gap: "0.2rem 0.75rem" }}>
            {settings.map(({ path, text }) => (
              <div key={path} style={{ display: "contents" }}>
                <dt>
                  <code>{path}</code>
                </dt>
                <dd style={{ margin: 0 }}>{text}</dd>
              </div>
            ))}
          </dl>
          {factors.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                <caption style={{ textAlign: "left", captionSide: "top", color: "var(--text-secondary)" }}>
                  Faktoren mit ihrer veröffentlichten Spanne (bei IPCC-Faktoren das 95-%-Intervall)
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={TH}>Faktor</th>
                    <th scope="col" style={TH}>Wert</th>
                    <th scope="col" style={TH}>Intervall</th>
                    <th scope="col" style={TH}>Einheit</th>
                    <th scope="col" style={TH}>Fundstelle</th>
                  </tr>
                </thead>
                <tbody>
                  {factors.map(({ path, factor }) => (
                    <tr key={path}>
                      <th scope="row" style={{ ...TD, fontWeight: 400 }}>
                        <code>{path}</code>
                      </th>
                      <td className="tabular-nums" style={TD}>{NUMBER.format(factor.value)}</td>
                      <td className="tabular-nums" style={TD}>
                        {factor.low !== undefined && factor.high !== undefined
                          ? `${NUMBER.format(factor.low)} bis ${NUMBER.format(factor.high)}`
                          : "—"}
                      </td>
                      <td style={TD}>{factor.unit}</td>
                      <td style={TD}>{factor.citation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </article>
  );
}
