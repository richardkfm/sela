// Method page — how sela scores, in public, with weights and sources
// listed (mvp.md §7). Rendered from live criterion_definition/source rows,
// so it cannot drift from the scoring code in effect (roadmap §5.1). Phase
// 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { listCriterionDefinitions, listSources } from "@/lib/db/queries/criteria";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES } from "@/lib/scoring/types";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

export default async function MethodPage() {
  const [allDefinitions, sources] = await Promise.all([listCriterionDefinitions(), listSources()]);
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
                  {definition.appliesTo.join(", ")}
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
    </main>
  );
}
