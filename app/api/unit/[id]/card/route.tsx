// Scenario card export (roadmap §5.3, design-language.md §7). Node runtime
// — needs pg's TCP sockets, not available under the Edge runtime.
//
// "A card that cannot cite itself must not render" (design-language.md §7)
// is implemented here as control flow, not a comment: every source this
// card needs is resolved *before* ImageResponse is constructed, and any
// missing lookup returns a JSON error instead of an image.

import { ImageResponse } from "next/og";
import { getCriterionDefinition, getSource, type SourceRow } from "@/lib/db/queries/criteria";
import { getSpatialUnitById } from "@/lib/db/queries/spatial-units";
import { listVerdictsForUnit } from "@/lib/db/queries/verdicts";
import { scenarioTokens, technologyToTokenKey } from "@/lib/design/tokens";
import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import type { SuitabilityVerdict } from "@/lib/scoring/types";

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

  const reasonId = headline.excludedByCriterionId ?? headline.limitingCriterionId;
  if (!reasonId) {
    return Response.json({ error: "verdict carries no criterion to cite" }, { status: 422 });
  }
  const reason = await getCriterionDefinition(reasonId);
  if (!reason) {
    return Response.json({ error: `criterion "${reasonId}" not found — refusing to render uncited card` }, { status: 422 });
  }
  const source = await getSource(reason.sourceId);
  if (!source) {
    return Response.json({ error: `source "${reason.sourceId}" not found — refusing to render uncited card` }, { status: 422 });
  }

  const sources: SourceRow[] = [source];
  const tokenKey = technologyToTokenKey[headline.technology];
  const token = scenarioTokens[tokenKey];
  const { width, height } = SIZES[format];
  const headlineText =
    headline.verdict === "excluded"
      ? `${TECHNOLOGY_LABEL_DE[headline.technology]}: ausgeschlossen durch ${reason.nameDe}`
      : `${TECHNOLOGY_LABEL_DE[headline.technology]}: ${headline.verdict === "suitable" ? "geeignet" : "ungeeignet"} — begrenzt durch ${reason.nameDe}`;

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
            {`Synthetische Demo-Fläche · Fixture-Region · ${ILLUSTRATIVE_MARKER.de}`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: token.light }} />
            <div style={{ fontSize: 36, fontWeight: 700 }}>{headlineText}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 22 }}>
          <div>
            {`${reason.nameDe} (${reason.direction === "lower_better" ? "niedriger ist besser" : "höher ist besser"})`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 16, color: "#54524c", borderTop: "1px solid #d8d5cc", paddingTop: 16 }}>
          {sources.map((s) => (
            <div key={s.id}>
              {`${s.dataset} · ${s.publisher} · ${s.licence} · abgerufen ${s.retrievedAt ?? "unbekannt"}`}
            </div>
          ))}
          <div>© OpenMapTiles © OpenStreetMap contributors</div>
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
