// Method page — how sela scores, in public, with weights and sources
// listed (mvp.md §7). Rendered from live criterion_definition/source rows,
// so it cannot drift from the scoring code in effect (roadmap §5.1). Phase
// 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { listCriterionDefinitions, listSources } from "@/lib/db/queries/criteria";
import { listOutcomeMethods, type OutcomeMethodRow } from "@/lib/db/queries/outcomes";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import type { CitedFactor, OutcomeMethod } from "@/lib/scoring/nature/method";
import { DIMENSION_LABEL_DE } from "@/lib/scoring/outcome-display";
import { TECHNOLOGIES } from "@/lib/scoring/types";
import { appliesToLabel } from "@/lib/scoring/labels";

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
      <IllustrativeBanner kind={definitions.some((d) => !d.id.startsWith("fixture_")) ? "real" : "fixture"} />
      <div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600 }}>Methode</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Diese Seite listet exakt die <code>criterion_definition</code>-Zeilen, die die
          Bewertungs-Engine (<code>lib/scoring/</code>, Methodenversion{" "}
          <span className="tabular-nums">{CURRENT_METHOD_VERSION}</span>) tatsächlich liest — sie kann
          daher nicht vom aktiven Code abweichen. Die echte Kriterienkatalog-Gewichtung ist noch
          offen; siehe <code>docs/domain/scoring-criteria.md</code>. Kriterien mit dem Präfix{" "}
          <code>fixture_</code> gehören zum synthetischen Beispieldatensatz, alle anderen lesen echte
          Messwerte der Pilotregion Uckermark – mit derselben Platzhalter-Gewichtung.
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
                  {definition.weight}
                </td>
                <td style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid var(--surface-1)" }}>
                  {source?.dataset ?? definition.sourceId}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section aria-labelledby="ergebnis-methoden" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 id="ergebnis-methoden" style={{ fontSize: "1.2rem", fontWeight: 600, margin: "1rem 0 0" }}>
          Wie die Ergebnisse berechnet werden
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Was erhalten bleibt und was eine Renaturierung verbessert, rechnet sela nach veröffentlichten Methoden,
          nicht mit Gewichten. Jede Methode unten nennt ihre Quelle und jeden Faktor, den sie verwendet; jede Zahl
          im Szenarienvergleich führt über ihre Eingangswerte zu deren Quelle. Wo eine Methode einen Bereich
          ausgibt, zeigt sela den Bereich, nicht nur einen Mittelwert.
        </p>
        {CITED_OUTCOME_METHODS.map(({ method }) => (
          <OutcomeMethodSection key={method.methodVersion} method={method} stored={storedByVersion.get(method.methodVersion)} />
        ))}
      </section>
    </main>
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
                  Faktoren mit ihrem veröffentlichten 95-%-Intervall
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
