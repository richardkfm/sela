// Several cells summarised as one site (roadmap Step 5;
// docs/domain/decision-memo-finding-land.md): the practical answer to
// ADR-0001's admitted gap — a hex cell is not what a council names — until
// Flurstück geometry is affordable. Everything here is a count or a sum of
// what the single-cell screens show, and says over how many cells it was
// formed (lib/scoring/site.ts). Printable (mvp.md F5).

import Link from "next/link";
import { ConfidenceMark } from "@/components/ConfidenceMark";
import { MethodNote } from "@/components/MethodNote";
import { NotApplicableBadge } from "@/components/NotApplicableBadge";
import { NotModelledBadge } from "@/components/NotModelledBadge";
import { PrintButton } from "@/components/PrintButton";
import { PrintFooter } from "@/components/PrintFooter";
import { SourceAttribution } from "@/components/SourceAttribution";
import { scenarioToTokenKey, scenarioTokens } from "@/lib/design/tokens";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE, mapVerdictsFor } from "@/lib/map/verdict-style";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import { DIMENSION_LABEL_DE } from "@/lib/scoring/outcome-display";
import { CATEGORY_LABEL_DE, formatShareDe } from "@/lib/scoring/protection-flags";
import { irradiationNationalPositionDe } from "@/lib/scoring/pv-rules";
import { HABITAT_CAVEAT_DE } from "@/lib/scoring/habitat";
import { aggregateSiteMetric, countClasses, describeSiteTotal, type SiteCell } from "@/lib/scoring/site";
import { SCENARIOS, TECHNOLOGIES } from "@/lib/scoring/types";
import { MAX_GROUP_CELLS, MAX_SIDE_BY_SIDE, parseIds } from "@/lib/search/group";
import { loadUnitSet, sourcesUsed } from "@/lib/site/unit-set";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const HA = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const COUNT = new Intl.NumberFormat("de-DE");
const ONE_DECIMAL = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function Total({ cell }: { cell: SiteCell }) {
  return (
    <>
      {cell.kind === "not_modelled" && <NotModelledBadge />}
      {cell.kind === "not_applicable" && <NotApplicableBadge reasonDe={null} />}
      {cell.kind === "value" && (
        <>
          <span style={{ whiteSpace: "nowrap" }}>{cell.valueText}</span>{" "}
          {cell.confidence && <ConfidenceMark confidence={cell.confidence} compact />}
          {cell.centralText && <span className="sub">{cell.centralText}</span>}
          {cell.deltaText && <span className="sub">{cell.deltaText}</span>}
        </>
      )}
      {cell.coverageDe && <span className="sub">{cell.coverageDe}</span>}
    </>
  );
}

export default async function SitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const ids = parseIds(query.ids, MAX_GROUP_CELLS);
  if (!ids) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Keine gültige Auswahl</h1>
        <p>
          Eine Fläche aus mehreren Zellen braucht zwischen 1 und {MAX_GROUP_CELLS} Zellen. <Link href="/">Zur Karte</Link>
        </p>
      </main>
    );
  }
  const set = await loadUnitSet(ids);
  const first = set.units[0];
  if (!first) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: "48rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Diese Zellen gibt es nicht</h1>
        <p>
          <Link href="/">Zur Karte</Link>
        </p>
      </main>
    );
  }
  const regionKind = pilotRegionInfo(first.unit.pilotRegion).kind;
  const cellIds = set.units.map((u) => u.unit.id);
  const areaHa = new Map(set.units.map((u) => [u.unit.id, u.unit.areaHa]));
  const totalHa = set.units.reduce((sum, u) => sum + u.unit.areaHa, 0);
  const municipalities = [...new Set(set.units.flatMap((u) => (u.municipality ? [u.municipality.name] : [])))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  const classes = mapVerdictsFor(regionKind);
  const verdicts = set.units.flatMap((u) => u.verdicts);

  // Prüfhinweise, one line per named area, with how many cells it touches.
  const flagsByArea = new Map<string, { label: string; legalRef: string; cells: number; maxShare: number }>();
  for (const reading of set.units) {
    for (const flag of reading.flags) {
      const key = `${flag.category}/${flag.areaCode}/${flag.name}`;
      const entry = flagsByArea.get(key) ?? {
        label: `${CATEGORY_LABEL_DE[flag.category]} „${flag.name}“ (${flag.areaCode})`,
        legalRef: flag.legalRef,
        cells: 0,
        maxShare: 0,
      };
      entry.cells += 1;
      entry.maxShare = Math.max(entry.maxShare, flag.share);
      flagsByArea.set(key, entry);
    }
  }
  const flagCells = set.units.filter((u) => u.flags.length > 0).length;

  // Mapped biotopes, one line per biotope (a biotope can touch several cells).
  const biotopes = new Map<string, { nameDe: string; protectedDe: string | null; lrtDe: string | null; gradeDe: string | null; cells: number }>();
  for (const reading of set.units) {
    for (const fact of reading.habitat) {
      const entry = biotopes.get(fact.biotopeId) ?? { nameDe: fact.nameDe, protectedDe: fact.protectedDe, lrtDe: fact.lrtDe, gradeDe: fact.gradeDe, cells: 0 };
      entry.cells += 1;
      biotopes.set(fact.biotopeId, entry);
    }
  }
  const biotopeList = [...biotopes.values()].sort(
    (a, b) => Number(b.protectedDe !== null) - Number(a.protectedDe !== null) || Number(b.lrtDe !== null) - Number(a.lrtDe !== null) || b.cells - a.cells,
  );

  // Land cover as the classification reads it.
  const landCover = new Map<string, { label: string; tier: string; cells: number; ha: number }>();
  for (const reading of set.units) {
    const key = reading.landCover ? String(reading.landCover.code) : "–";
    const entry = landCover.get(key) ?? {
      label: reading.landCover?.classDe ?? "kein Wert",
      // The neutral screen name of the tier (decision D4), as on the parcel page.
      tier: reading.landCover?.classLabelDe ?? "–",
      cells: 0,
      ha: 0,
    };
    entry.cells += 1;
    entry.ha += reading.unit.areaHa;
    landCover.set(key, entry);
  }
  const irradiation = set.units.flatMap((u) => {
    const v = u.values.get("pv_irradiation_annual");
    return v ? [v.value] : [];
  });
  const slope = set.units.flatMap((u) => {
    const v = u.values.get("pv_slope");
    return v ? [v.value] : [];
  });

  const metricLines = CITED_OUTCOME_METHODS.flatMap((cited) =>
    cited.method.metrics.map((info) => {
      const rowsFor = (scenario: (typeof SCENARIOS)[number]) =>
        set.outcomes.filter((o) => o.methodVersion === cited.method.methodVersion && o.metric === info.metric && o.scenario === scenario);
      const totals = Object.fromEntries(SCENARIOS.map((s) => [s, aggregateSiteMetric(rowsFor(s), areaHa, info.siteAggregation)]));
      const cells = Object.fromEntries(
        SCENARIOS.map((s) => [
          s,
          describeSiteTotal(totals[s]!, s === "status_quo" ? null : totals.status_quo!, info.notApplicableByScenarioDe?.[s] ?? info.notApplicableDe ?? null),
        ]),
      ) as Record<(typeof SCENARIOS)[number], SiteCell>;
      return { method: cited.method, info, cells };
    }),
  );
  const sources = sourcesUsed(set);
  const methodVersions = [CURRENT_METHOD_VERSION, ...CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion)];

  return (
    <main style={{ padding: "1.5rem", maxWidth: "72rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <MethodNote kind={regionKind} />
      <div>
        <p className="no-print">
          <Link href="/">← Zur Karte</Link>
        </p>
        <p className="overline">Fläche aus mehreren Zellen</p>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>
          <span className="tabular-nums">{COUNT.format(set.units.length)}</span> Zellen ·{" "}
          <span className="tabular-nums">{HA.format(totalHa)}&nbsp;ha</span>
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {municipalities.length > 0 ? `Gemeinde${municipalities.length > 1 ? "n" : ""}: ${municipalities.join(", ")}` : "Ohne Gemeindezuordnung"}
          {" · "}Zusammengefasst sind die Werte der einzelnen Zellen; die Fläche ist kein Flurstück und kein Plangebiet.
        </p>
        {set.missing.length > 0 && (
          <p role="note">{set.missing.length} der angegebenen Zellen gibt es nicht; sie sind nicht enthalten.</p>
        )}
        {set.otherRegion.length > 0 && (
          <p role="note">
            {set.otherRegion.length} Zelle{set.otherRegion.length === 1 ? " liegt" : "n liegen"} in einer anderen Region und
            {set.otherRegion.length === 1 ? " ist" : " sind"} nicht enthalten.
          </p>
        )}
        <div className="explorer-views no-print" style={{ marginTop: "0.6rem" }}>
          <PrintButton />
          {set.units.length >= 2 && set.units.length <= MAX_SIDE_BY_SIDE && (
            <Link className="btn btn-small" href={`/compare?ids=${cellIds.join(",")}&scenario=develop_pv`}>
              Zellen nebeneinander vergleichen
            </Link>
          )}
        </div>
      </div>

      <section aria-labelledby="classes-heading">
        <h2 id="classes-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {regionKind === "real" ? "Einordnung je Technologie" : "Eignung je Technologie · illustrativ"}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <caption>Anzahl Zellen je Klasse. Jede Zelle behält ihre eigene Einordnung; es gibt keine Gesamtnote.</caption>
            <thead>
              <tr>
                <th scope="col">Technologie</th>
                {classes.map((c) => (
                  <th key={c} scope="col">
                    {VERDICT_LABEL_DE[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TECHNOLOGIES.map((technology) => {
                const counts = countClasses(verdicts, technology, cellIds);
                return (
                  <tr key={technology}>
                    <th scope="row">{TECHNOLOGY_LABEL_DE[technology]}</th>
                    {classes.map((c) => (
                      <td key={c} className="tabular-nums">
                        {COUNT.format(counts.get(c) ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="flags-heading">
        <h2 id="flags-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Prüfhinweise · Schutzgebiete
        </h2>
        {flagsByArea.size === 0 ? (
          <p className="muted">Keine Zelle berührt nach den Übersichtsdaten des LfU ein Schutzgebiet, das einen Prüfhinweis auslöst.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {COUNT.format(flagCells)} von {COUNT.format(set.units.length)} Zellen tragen mindestens einen Prüfhinweis
              (nach den Übersichtsdaten des LfU). Was er für ein Vorhaben bedeutet, steht bei der einzelnen Zelle.
            </p>
            <ul className="flag-list">
              {[...flagsByArea.values()].map((f) => (
                <li key={f.label} className="flag-note">
                  <span aria-hidden className="flag-glyph">
                    §
                  </span>
                  <span>
                    {f.label} – in {COUNT.format(f.cells)} Zelle{f.cells === 1 ? "" : "n"}, höchstens {formatShareDe(f.maxShare)} einer
                    Zelle · {f.legalRef}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {set.hasHabitatData && (
        <section aria-labelledby="habitat-heading">
          <h2 id="habitat-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Naturkapital · kartierte Biotope
          </h2>
          {biotopeList.length === 0 ? (
            <p className="muted">In keiner der Zellen ist im Biotopkataster ein Biotop erfasst.</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                {COUNT.format(biotopeList.length)} Biotop{biotopeList.length === 1 ? "" : "e"} im Biotopkataster erfasst,{" "}
                {COUNT.format(biotopeList.filter((b) => b.protectedDe).length)} davon als geschützt,{" "}
                {COUNT.format(biotopeList.filter((b) => b.lrtDe).length)} mit FFH-Lebensraumtyp. Kategorien, keine Summe.
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem" }}>
                {biotopeList.slice(0, 20).map((b, i) => (
                  <li key={i}>
                    {b.nameDe} – in {COUNT.format(b.cells)} Zelle{b.cells === 1 ? "" : "n"}
                    {b.protectedDe && " · geschützt laut Kataster"}
                    {b.lrtDe && ` · ${b.lrtDe}${b.gradeDe ? `, ${b.gradeDe}` : ""}`}
                  </li>
                ))}
              </ul>
              {biotopeList.length > 20 && <p className="muted">… und {COUNT.format(biotopeList.length - 20)} weitere, bei den einzelnen Zellen.</p>}
            </>
          )}
          <p className="muted" style={{ fontSize: "0.8rem" }}>{HABITAT_CAVEAT_DE}</p>
        </section>
      )}

      <section aria-labelledby="measured-heading">
        <h2 id="measured-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Messwerte
        </h2>
        <table className="data-table">
          <caption>Bodenbedeckung nach der Klasse, die die Zelle überwiegend bedeckt (CLC5 2018).</caption>
          <thead>
            <tr>
              <th scope="col">Bodenbedeckung</th>
              <th scope="col">Einordnung für PV</th>
              <th scope="col">Zellen</th>
              <th scope="col">Fläche</th>
            </tr>
          </thead>
          <tbody>
            {[...landCover.values()]
              .sort((a, b) => b.cells - a.cells)
              .map((lc) => (
                <tr key={lc.label}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {lc.label}
                  </th>
                  <td>{lc.tier}</td>
                  <td className="tabular-nums">{COUNT.format(lc.cells)}</td>
                  <td className="tabular-nums">{HA.format(lc.ha)}&nbsp;ha</td>
                </tr>
              ))}
          </tbody>
        </table>
        <ul style={{ margin: "0.6rem 0 0", paddingLeft: "1.2rem" }}>
          {irradiation.length > 0 && (
            <li>
              Globalstrahlung{" "}
              <span className="tabular-nums">
                {WHOLE.format(Math.min(...irradiation))} bis {WHOLE.format(Math.max(...irradiation))} kWh/m²·a
              </span>{" "}
              – {irradiationNationalPositionDe(Math.min(...irradiation))}
              {irradiationNationalPositionDe(Math.min(...irradiation)) !== irradiationNationalPositionDe(Math.max(...irradiation)) &&
                ` bis ${irradiationNationalPositionDe(Math.max(...irradiation))}`}
              {irradiation.length < set.units.length && ` (${set.units.length - irradiation.length} Zellen ohne Wert)`}
            </li>
          )}
          {slope.length > 0 && (
            <li>
              Neigung{" "}
              <span className="tabular-nums">
                {ONE_DECIMAL.format(Math.min(...slope))} bis {ONE_DECIMAL.format(Math.max(...slope))}°
              </span>{" "}
              – nur Messwert (200-m-Geländemodell), nicht eingestuft
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="outcomes-heading">
        <h2 id="outcomes-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Was jedes Szenario auf dieser Fläche bedeutet
        </h2>
        {metricLines.length === 0 || regionKind === "fixture" ? (
          <p className="muted">
            Für den Beispieldatensatz gibt es keine zitierten Ergebnis-Methoden; die illustrativen Werte werden nicht über
            Zellen summiert.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <caption>
                Summen über die Zellen, für die die Methode einen Wert hat (Größen je Hektar), oder Flächenmittel (Zustände
                wie Versickerung) – darunter jeweils, über wie viele Zellen. Δ gegenüber dem Ist-Zustand nur, wo beide
                dieselben Zellen umfassen. Konfidenz: ● hoch, ◐ mittel, ○ niedrig; die niedrigste der Zellen zählt.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Größe</th>
                  {SCENARIOS.map((s) => (
                    <th key={s} scope="col">
                      {scenarioTokens[scenarioToTokenKey[s]].labelDe}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricLines.map((line) => (
                  <tr key={`${line.method.methodVersion}/${line.info.metric}`}>
                    <th scope="row">
                      <span className="sub">{DIMENSION_LABEL_DE[line.method.dimension]}</span>
                      {line.info.labelDe}
                      <span className="sub">{line.info.siteAggregation === "sum_per_ha" ? "Summe" : "Flächenmittel"}</span>
                    </th>
                    {SCENARIOS.map((s) => (
                      <td key={s} className="tabular-nums">
                        <Total cell={line.cells[s]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Methoden und Spannen: <Link href="/method#ergebnis-methoden">Methode</Link>. Naturkapital wird nur als
          Kategorie gezeigt (oben); Flächennutzung und regionaler Nutzen sind noch nicht modelliert.
        </p>
      </section>

      <section aria-labelledby="cells-heading" className="no-print">
        <h2 id="cells-heading" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
          Die Zellen
        </h2>
        <ul className="unit-list" style={{ columns: "14rem" }}>
          {set.units.map((u) => (
            <li key={u.unit.id}>
              <Link href={`/unit/${u.unit.id}`}>
                <span className="tabular-nums">{u.unit.id.slice(0, 8)}</span>
              </Link>{" "}
              <span className="muted">{u.municipality?.name ?? ""}</span>
            </li>
          ))}
        </ul>
      </section>

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
