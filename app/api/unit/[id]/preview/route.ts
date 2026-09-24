// Geometry for the 3D parcel preview (ADR-0006): the unit, its neighbours'
// verdicts for context, and — depending on the technology — either the row
// layout (PV, Agri-PV) or the cited setback rings (wind). All of it computed
// by lib/db/queries/preview.ts in PostGIS; this route validates input and
// assembles the response, nothing more.

import { NextResponse } from "next/server";
import {
  getPreviewUnit,
  listPreviewNeighbours,
  listPreviewRings,
  listPreviewRows,
} from "@/lib/db/queries/preview";
import { pilotRegionInfo } from "@/lib/pilot-region";
import {
  AGRIPV_LAYOUT,
  PV_LAYOUT,
  REFERENCE_TURBINE,
  SETBACK_RINGS,
  TURBINE_SLIDER_BOUNDS,
} from "@/lib/preview/reference-geometry";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";

export const runtime = "nodejs";

/** Neighbours drawn around the unit — enough to reach the widest ring. */
const NEIGHBOUR_RADIUS_M = 1500;
/** Row fragments shorter than this are dropped rather than drawn as stubs. */
const MIN_ROW_LENGTH_M = 5;

function isTechnology(value: string): value is Technology {
  return (TECHNOLOGIES as readonly string[]).includes(value);
}

function boundedNumber(raw: string | null, fallback: number, bounds: { min: number; max: number }): number | null {
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) return null;
  return value;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const technology = url.searchParams.get("technology") ?? "wind";
  if (!isTechnology(technology)) {
    return NextResponse.json(
      { error: `invalid technology "${technology}", expected one of ${TECHNOLOGIES.join(", ")}` },
      { status: 400 },
    );
  }

  const hub = boundedNumber(url.searchParams.get("hub"), REFERENCE_TURBINE.hubHeight.value, TURBINE_SLIDER_BOUNDS.hubHeight);
  const rotor = boundedNumber(
    url.searchParams.get("rotor"),
    REFERENCE_TURBINE.rotorDiameter.value,
    TURBINE_SLIDER_BOUNDS.rotorDiameter,
  );
  if (hub === null || rotor === null) {
    return NextResponse.json({ error: "hub/rotor outside the preview's supported range" }, { status: 400 });
  }

  const unit = await getPreviewUnit(id);
  if (!unit) return NextResponse.json({ error: "unit not found" }, { status: 404 });

  const region = pilotRegionInfo(unit.pilotRegion);
  const applicableRings =
    technology === "wind"
      ? SETBACK_RINGS.filter((ring) => region.jurisdictions.includes(ring.jurisdiction))
      : [];

  const layout = technology === "agripv" ? AGRIPV_LAYOUT : PV_LAYOUT;
  const [neighbours, rows, ringGeometry] = await Promise.all([
    listPreviewNeighbours(id, technology, CURRENT_METHOD_VERSION, NEIGHBOUR_RADIUS_M),
    technology === "wind"
      ? Promise.resolve([])
      : listPreviewRows(id, {
          rowPitchM: layout.rowPitch.value,
          insetM: layout.inset.value,
          postSpacingM: layout.postSpacing.value,
          minLengthM: MIN_ROW_LENGTH_M,
        }),
    listPreviewRings(
      id,
      applicableRings.map((ring) => ring.radiusM(hub, rotor)),
    ),
  ]);

  return NextResponse.json({
    unit,
    technology,
    turbine: { hubHeightM: hub, rotorDiameterM: rotor },
    neighbours,
    rows,
    // listPreviewRings orders by radius; re-pair each geometry with its rule by radius, not index.
    rings: applicableRings.map((ring) => {
      const radiusM = ring.radiusM(hub, rotor);
      const geometry = ringGeometry.find((g) => Math.abs(g.radiusM - radiusM) < 1e-6);
      return { id: ring.id, radiusM, ...geometry };
    }),
    jurisdiction: region.jurisdictions.length > 0 ? { asIfIn: region.asIfIn ?? null } : null,
  });
}
