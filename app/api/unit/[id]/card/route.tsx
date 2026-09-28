// Scenario card export (roadmap §5.3, design-language.md §7). Node runtime
// — needs pg's TCP sockets, not available under the Edge runtime.
//
// "A card that cannot cite itself must not render" (design-language.md §7)
// is implemented here as control flow, not a comment: every source this
// card needs is resolved *before* ImageResponse is constructed, and any
// missing lookup returns a JSON error instead of an image.

import { ImageResponse } from "next/og";
import { partitionByCitability, renderAttribution } from "@/lib/attribution";
import { getActiveBasemap } from "@/lib/basemap/basemap-source";
import {
  getCriterionDefinition,
  getSource,
  listCriterionDefinitions,
  listCriterionValuesForUnit,
  type CriterionDefinitionRow,
  type SourceRow,
} from "@/lib/db/queries/criteria";
import { pilotRegionInfo } from "@/lib/pilot-region";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import type { SuitabilityVerdict } from "@/lib/scoring/types";
import { VERDICT_LABEL_DE, isClassified, readLandCover } from "@/lib/scoring/verdict-text";
import { verdictAppearance } from "@/lib/map/verdict-style";

export const runtime = "nodejs";

const SIZES = {
  og: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  print: { width: 1240, height: 1754 }, // ~A4 at 150dpi, portrait
} as const;

const TECHNOLOGY_LABEL_DE: Record<SuitabilityVerdict["technology"], string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

function pickHeadlineVerdict(verdicts: readonly SuitabilityVerdict[]): SuitabilityVerdict | null {
  return verdicts.find((v) => v.verdict === "suitable") ?? verdicts[0] ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = (new URL(request.url).searchParams.get("format") ?? "og") as keyof typeof SIZES;
  if (!(format in SIZES)) {
    return Response.json({ error: `invalid format "${format}"` }, { status: 400 });
  }

  const unit = await getSpatialUnitById(id);
  if (!unit) {
    return Response.json({ error: `no spatial unit "${id}"` }, { status: 404 });
  }

  const verdicts = await listVerdictsForUnit(id, CURRENT_METHOD_VERSION);
  const headline = pickHeadlineVerdict(verdicts);
  if (!headline) {
    return Response.json(
      { error: "no suitability verdict for this unit — cannot cite a headline claim" },
      { status: 422 },
    );
  }

  // The criteria this card cites: the one that decided or limits the verdict,
  // or — where no criterion stands out (decision memo Q5) — every criterion
  // that entered the score, so the card still cites what its headline rests on.
  const reasonId = headline.excludedByCriterionId ?? headline.limitingCriterionId;
  const cited = reasonId
    ? [await getCriterionDefinition(reasonId)]
    : (await listCriterionDefinitions()).filter(
        (d) => d.appliesTo.includes(headline.technology) && !d.isHardConstraint && !d.isCategory && d.weight > 0,
      );
  if (cited.length === 0) {
    return Response.json({ error: "verdict carries no criterion to cite" }, { status: 422 });
  }
  const missing = cited.findIndex((d) => d === null);
  if (missing !== -1) {
    return Response.json({ error: `criterion "${reasonId}" not found — refusing to render uncited card` }, { status: 422 });
  }
  const criteria = cited as CriterionDefinitionRow[];
  const sources: SourceRow[] = [];
  for (const sourceId of new Set(criteria.map((d) => d.sourceId))) {
    const source = await getSource(sourceId);
    if (!source) {
      return Response.json({ error: `source "${sourceId}" not found — refusing to render uncited card` }, { status: 422 });
    }
    sources.push(source);
  }

  // design-language.md §7: "a card that cannot cite itself must not render."
  // A source whose Quellenvermerk was never recorded is exactly that case, so
  // it fails here with the ids named rather than rendering a card that quietly
  // omits a legally required notice.
  const { uncitable } = partitionByCitability(sources);
  if (uncitable.length > 0) {
    return Response.json(
      {
        error: "refusing to render: no attribution recorded for source(s)",
        sources: uncitable.map((s) => s.id),
        seeAlso: "docs/data/sources.md §7 condition 4",
      },
      { status: 422 },
    );
  }
  const basemapAttribution = getActiveBasemap().attribution;
  const { width, height } = SIZES[format];
  const region = pilotRegionInfo(unit.pilotRegion);
  const names = criteria.map((d) => d.nameDe).join(", ");
  const technologyLabel = TECHNOLOGY_LABEL_DE[headline.technology];
  // A classified verdict decided by land cover names the class that placed it.
  const landCoverValue = (await listCriterionValuesForUnit(id)).find((v) => v.criterionId === "pv_land_cover");
  const landCoverClass =
    landCoverValue && criteria.some((d) => d.isCategory) ? `Bodenbedeckung: ${readLandCover(landCoverValue.value).classDe}` : names;
  const headlineText =
    headline.verdict === "excluded"
      ? `${technologyLabel}: ausgeschlossen durch ${names}`
      : isClassified(headline.verdict)
        ? `${technologyLabel}: ${VERDICT_LABEL_DE[headline.verdict]} — ${landCoverClass}`
        : `${technologyLabel}: ${VERDICT_LABEL_DE[headline.verdict]} — ${
            reasonId ? `begrenzt am deutlichsten durch ${names}` : "kein Kriterium deutlich unter dem Regionsbesten"
          }`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          background: "#faf9f6",
          color: "#1f1e1b",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 20, color: "#54524c" }}>
            {region.kind === "real"
              ? `Rasterzelle · ${region.nameDe} · veröffentlichte Regeln, echte Messwerte · beratend, keine Planungs- oder Genehmigungsaussage`
              : `Synthetische Demo-Fläche · Fixture-Region · ${ILLUSTRATIVE_MARKER.de}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: verdictAppearance(headline.verdict, headline.technology).color }} />
            <div style={{ fontSize: 36, fontWeight: 700 }}>{headlineText}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 22 }}>
          {criteria.map((d) => (
            <div key={d.id}>
              {`${d.nameDe} (${d.isCategory ? "Kategorie" : d.isHardConstraint ? "Ausschlusskriterium" : d.direction === "lower_better" ? "niedriger ist besser" : "höher ist besser"})`}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 16, color: "#54524c", borderTop: "1px solid #d8d5cc", paddingTop: 16 }}>
          {sources.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column" }}>
              <div>
                {`${s.dataset} · ${s.publisher} · ${s.licence} · abgerufen ${s.retrievedAt ?? "unbekannt"}`}
              </div>
              {/* The publisher's required notice, verbatim. Not a restatement
                  of the line above: dl-de/by-2-0, GeoNutzV and CC BY 4.0 each
                  demand specific wording, and a card is an "öffentliche
                  Wiedergabe" that must carry it. */}
              <div>{renderAttribution(s)}</div>
            </div>
          ))}
          {/* Whichever basemap is actually serving — never a second
              hard-coded credit that can drift from the live map. */}
          {basemapAttribution ? <div>{basemapAttribution}</div> : null}
          <div>
            {`Methodenversion ${CURRENT_METHOD_VERSION} · erzeugt am ${new Date().toISOString().slice(0, 10)}`}
          </div>
          <div style={{ fontStyle: "italic" }}>
            sela informiert Entscheidungen; es ersetzt keine Planungs- oder Genehmigungsprüfung.
          </div>
        </div>
      </div>
    ),
    { width, height },
  );
}
