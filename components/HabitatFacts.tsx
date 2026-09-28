// Nature capital as categories (roadmap Step 4; scoring-criteria.md §4.3):
// what the LfU Biotopkataster records on a cell, in its own words — never a
// score. Shared by the parcel page and the scenario comparison.

import { SourceAttribution } from "@/components/SourceAttribution";
import type { SourceRow } from "@/lib/db/queries/criteria";
import { HABITAT_CAVEAT_DE, type HabitatFact } from "@/lib/scoring/habitat";

export function HabitatFacts({
  facts,
  source,
  hasData,
  headingLevel = 2,
}: {
  facts: readonly HabitatFact[];
  source: SourceRow | null;
  /** False where the region has no Biotopkataster data loaded — then nothing is claimed either way. */
  hasData: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="habitat-heading" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <Heading id="habitat-heading" style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0.5rem 0 0" }}>
        Naturkapital · kartierte Biotope
      </Heading>
      {!hasData ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Für diese Region ist das Biotopkataster noch nicht eingelesen.
        </p>
      ) : facts.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Im Biotopkataster ist hier kein Biotop erfasst (Flächen unter 1 % der Zelle nicht gezählt).
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.9rem" }}>
          {facts.map((f) => (
            <li key={f.biotopeId}>
              <strong style={{ fontWeight: 600 }}>{f.nameDe}</strong> – {f.extentDe}
              {f.protectedDe && <span style={{ display: "block" }}>{f.protectedDe}</span>}
              {f.lrtDe && (
                <span style={{ display: "block" }}>
                  {f.lrtDe}
                  {f.gradeDe && <> · {f.gradeDe}</>}
                </span>
              )}
              <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                {f.mappedDe}
                {f.aerialOnly && " – nicht im Gelände überprüft"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
        Kategorien, keine Bewertung und keine Punktzahl. {HABITAT_CAVEAT_DE} Quelle:{" "}
        {source ? <SourceAttribution source={source} /> : "LfU Brandenburg, Biotopkataster"}
      </p>
    </section>
  );
}
