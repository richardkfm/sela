// Cells side by side under one scenario (mvp.md F6, roadmap Step 5): "where
// should this go" rather than "what should happen here". Columns are cells,
// rows are the same readings the parcel page shows — classes, Prüfhinweise,
// measured values, and each cited outcome under the chosen scenario with its
// change against the status quo. Nothing is ranked or totalled: the reader
// compares (CLAUDE.md §4.5). Printable (mvp.md F5).

import Link from "next/link";
import { ConfidenceMark } from "@/components/ConfidenceMark";
import { MethodNote } from "@/components/MethodNote";
import { NotApplicableBadge } from "@/components/NotApplicableBadge";
import { NotModelledBadge } from "@/components/NotModelledBadge";
import { PrintButton } from "@/components/PrintButton";
import { PrintFooter } from "@/components/PrintFooter";
import { SourceAttribution } from "@/components/SourceAttribution";
import { scenarioToTokenKey, scenarioTokens } from "@/lib/design/tokens";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE } from "@/lib/map/verdict-style";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { formatCriterionValue } from "@/lib/scoring/format-value";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import { DIMENSION_LABEL_DE, describeOutcomeCell, type OutcomeCell } from "@/lib/scoring/outcome-display";
import { irradiationNationalPositionDe } from "@/lib/scoring/pv-rules";
import { HABITAT_CAVEAT_DE } from "@/lib/scoring/habitat";
import { SCENARIOS, TECHNOLOGIES, type Scenario } from "@/lib/scoring/types";
import { MAX_SIDE_BY_SIDE, parseIds } from "@/lib/search/group";
import { loadUnitSet, sourcesUsed, type UnitReading } from "@/lib/site/unit-set";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const HA = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function Outcome({ cell }: { cell: OutcomeCell }) {
  if (cell.kind === "not_modelled") return <NotModelledBadge />;
  if (cell.kind === "not_applicable") return <NotApplicableBadge reasonDe={cell.reasonDe} />;
  return (
    <>
      <span style={{ whiteSpace: "nowrap" }}>{cell.valueText}</span> <ConfidenceMark confidence={cell.confidence} compact />
      {cell.centralText && <span className="sub">{cell.centralText}</span>}
      {cell.deltaText && <span className="sub">{cell.deltaText}</span>}
    </>
  );
}

function measured(reading: UnitReading, criterionId: string): string {
  const v = reading.values.get(criterionId);
  return v ? formatCriterionValue(criterionId, v.value, v.unit) : "kein Wert";
}

export default async function CompareCellsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const ids = parseIds(query.ids, MAX_SIDE_BY_SIDE);
  const requested = typeof query.scenario === "string" ? query.scenario : "develop_pv";
  const scenario: Scenario = (SCENARIOS as readonly string[]).includes(requested) ? (requested as Scenario) : "develop_pv";
  if (!ids || ids.length < 2) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Keine gültige Auswahl</h1>
        <p>
          Nebeneinander verglichen werden 2 bis {MAX_SIDE_BY_SIDE} Zellen. <Link href="/">Zur Karte</Link>
        </p>
      </main>
    );
  }
  const set = await loadUnitSet(ids);
  const first = set.units[0];
  const regionKind = first ? pilotRegionInfo(first.unit.pilotRegion).kind : "fixture";
  const idList = set.units.map((u) => u.unit.id).join(",");
  const scenarioLabel = scenarioTokens[scenarioToTokenKey[scenario]].labelDe;

  const metricRows = CITED_OUTCOME_METHODS.flatMap((cited) =>
    cited.method.metrics.map((info) => ({
      key: `${cited.method.methodVersion}/${info.metric}`,
      dimension: cited.method.dimension,
      labelDe: info.labelDe,
      cells: set.units.map((reading) => {
        const of = (s: Scenario) =>
          set.outcomes.find(
            (o) => o.spatialUnitId === reading.unit.id && o.methodVersion === cited.method.methodVersion && o.metric === info.metric && o.scenario === s,
          );
        return describeOutcomeCell(of(scenario), scenario === "status_quo" ? undefined : of("status_quo"), info);
      }),
    })),
  );
  const sources = sourcesUsed(set);
  const methodVersions = [CURRENT_METHOD_VERSION, ...CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion)];

  return (
    <main style={{ padding: "1.5rem", maxWidth: "76rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <MethodNote kind={regionKind} />
      <div>
        <p className="no-print">
          <Link href="/">← Zur Karte</Link>
          {" · "}
          <Link href={`/site?ids=${idList}`}>Als eine Fläche zusammenfassen</Link>
        </p>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>
          {set.units.length} Zellen nebeneinander — {scenarioLabel}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Dieselben Angaben wie auf der Seite jeder Zelle, nebeneinander. sela ordnet nicht in eine Reihenfolge; ob eine
          Zelle „besser“ ist, hängt davon ab, was man abwägt.
        </p>
        {set.missing.length > 0 && <p role="note">{set.missing.length} der angegebenen Zellen gibt es nicht.</p>}
        {set.otherRegion.length > 0 && (
          <p role="note">{set.otherRegion.length} Zelle(n) aus einer anderen Region sind nicht enthalten.</p>
        )}
      </div>

      <nav aria-label="Szenario wählen" className="no-print">
        <ul className="explorer-views" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {SCENARIOS.map((s) => (
            <li key={s}>
              <Link
                className={`btn btn-small${s === scenario ? " btn-primary" : ""}`}
                aria-current={s === scenario ? "page" : undefined}
                href={`/compare?ids=${idList}&scenario=${s}`}
              >
                {scenarioTokens[scenarioToTokenKey[s]].labelDe}
              </Link>
            </li>
          ))}
          <li>
            <PrintButton />
          </li>
        </ul>
      </nav>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <caption>
            Szenario „{scenarioLabel}“; Δ gegenüber dem Ist-Zustand derselben Zelle. Konfidenz: ● hoch, ◐ mittel, ○ niedrig.
            Ein Bereich wird als Bereich gezeigt.
          </caption>
          <thead>
            <tr>
              <th scope="col">Angabe</th>
              {set.units.map((u) => (
                <th key={u.unit.id} scope="col">
                  <Link href={`/unit/${u.unit.id}`} className="tabular-nums">
                    {u.unit.id.slice(0, 8)}
                  </Link>
                  <span className="sub">
                    {u.municipality?.name ?? ""} · <span className="tabular-nums">{HA.format(u.unit.areaHa)}&nbsp;ha</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TECHNOLOGIES.map((technology) => (
              <tr key={technology}>
                <th scope="row">
                  <span className="sub">{regionKind === "real" ? "Einordnung" : "Eignung · illustrativ"}</span>
                  {TECHNOLOGY_LABEL_DE[technology]}
                </th>
                {set.units.map((u) => (
                  <td key={u.unit.id}>{VERDICT_LABEL_DE[u.verdicts.find((v) => v.technology === technology)?.verdict ?? "unscored"]}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Prüfhinweise</th>
              {set.units.map((u) => (
                <td key={u.unit.id}>
                  {u.flags.length === 0 ? (
                    <span className="muted">keine</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                      {u.flags.map((f) => (
                        <li key={`${f.category}/${f.areaCode}/${f.name}`}>{f.shortDe}</li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
            </tr>
            {set.hasHabitatData && (
              <tr>
                <th scope="row">
                  Kartierte Biotope<span className="sub">Naturkapital · Kategorien</span>
                </th>
                {set.units.map((u) => (
                  <td key={u.unit.id}>
                    {u.habitat.length === 0 ? (
                      <span className="muted">keines erfasst</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                        {u.habitat.map((f) => (
                          <li key={f.biotopeId}>
                            {f.nameDe} ({f.extentDe})
                            {f.protectedDe && <span className="sub">geschützt laut Kataster</span>}
                            {f.lrtDe && <span className="sub">{f.lrtDe}{f.gradeDe ? ` · ${f.gradeDe}` : ""}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              <th scope="row">Bodenbedeckung</th>
              {set.units.map((u) => (
                <td key={u.unit.id}>
                  {u.landCover ? (
                    <>
                      {u.landCover.classDe}
                      <span className="sub">{u.landCover.classLabelDe}</span>
                    </>
                  ) : (
                    "kein Wert"
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Globalstrahlung</th>
              {set.units.map((u) => {
                const v = u.values.get("pv_irradiation_annual");
                return (
                  <td key={u.unit.id} className="tabular-nums">
                    {measured(u, "pv_irradiation_annual")}
                    {v && <span className="sub">{irradiationNationalPositionDe(v.value)}</span>}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">
                Neigung<span className="sub">nur Messwert</span>
              </th>
              {set.units.map((u) => (
                <td key={u.unit.id} className="tabular-nums">
                  {measured(u, "pv_slope")}
                </td>
              ))}
            </tr>
            {metricRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <span className="sub">{DIMENSION_LABEL_DE[row.dimension]}</span>
                  {row.labelDe}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={set.units[i]!.unit.id} className="tabular-nums">
                    <Outcome cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Methoden und Spannen: <Link href="/method#ergebnis-methoden">Methode</Link>. Naturkapital wird nur als Kategorie
        gezeigt (Biotopkataster); Flächennutzung und regionaler Nutzen sind noch nicht modelliert.
        {set.hasHabitatData && <> {HABITAT_CAVEAT_DE}</>}
      </p>

      <section aria-labelledby="sources-heading" className="no-print">
        <h2 id="sources-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Quellen
        </h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
          {sources.map((s) => (
            <li key={s.id}>
              <SourceAttribution source={s} />
            </li>
          ))}
        </ul>
      </section>
      <PrintFooter sources={sources} methodVersions={methodVersions} />
    </main>
  );
}
