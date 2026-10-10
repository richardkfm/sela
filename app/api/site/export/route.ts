// A site — cells chosen together — as a file for other tools (roadmap-
// planning-tool.md Phase 3): `/api/site/export?ids=a,b,c&format=geojson|csv`.
// GeoJSON carries each cell's polygon (EPSG:4326) with its classes, measured
// values and Prüfhinweise, and the sources at the collection level; CSV
// carries the same columns, one row per cell, each row citing its sources.
// design-language.md §7's rule applies to files as to cards: an export that
// cannot cite itself does not render — a source without a notice is a 500,
// never a file with a gap.

import { NextResponse } from "next/server";
import { isCitable, renderAttribution } from "@/lib/attribution";
import { listUnitGeometries } from "@/lib/db/queries/unit-set";
import { CURRENT_METHOD_VERSION } from "@/lib/scoring/method-version";
import { CITED_OUTCOME_METHODS } from "@/lib/scoring/nature";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";
import { VERDICT_LABEL_DE } from "@/lib/scoring/verdict-text";
import { MAX_GROUP_CELLS, parseIds } from "@/lib/search/group";
import { loadUnitSet, sourcesUsed, type UnitReading } from "@/lib/site/unit-set";

export const runtime = "nodejs";

const ADVISORY_DE = "sela ist beratend: keine Planungs-, Eignungs- oder Genehmigungsaussage.";

function verdictLabel(reading: UnitReading, technology: Technology): string {
  const verdict = reading.verdicts.find((v) => v.technology === technology);
  return verdict ? VERDICT_LABEL_DE[verdict.verdict] : "nicht bewertet";
}

function value(reading: UnitReading, criterionId: string): number | null {
  return reading.values.get(criterionId)?.value ?? null;
}

/** One cell's columns, the same for both formats. Units are in the column names so a number is never orphaned. */
function columns(reading: UnitReading, ags: string | null) {
  return {
    id: reading.unit.id,
    gemeinde_ags: ags,
    gemeinde: reading.municipality?.name ?? null,
    flaeche_ha: Number(reading.unit.areaHa.toFixed(2)),
    ...Object.fromEntries(TECHNOLOGIES.map((t) => [`einordnung_${t}`, verdictLabel(reading, t)])),
    bodenbedeckung_clc5: value(reading, "pv_land_cover"),
    bodenbedeckung: reading.landCover?.classDe ?? null,
    bodenbedeckung_stufe: reading.landCover?.tier ?? null,
    globalstrahlung_kwh_m2_a: value(reading, "pv_irradiation_annual"),
    neigung_grad: value(reading, "pv_slope"),
    schutzgebiet_anteil_nsg_nationalpark: value(reading, "pv_protection_status"),
    pruefhinweise_anzahl: reading.flags.length,
    pruefhinweise: reading.flags.map((f) => f.shortDe).join(" | ") || null,
    moorboden_anteil: value(reading, "peat_share"),
    versickerung_mm_a: value(reading, "water_percolation"),
    methode: CURRENT_METHOD_VERSION,
  };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const text = typeof v === "number" ? String(v).replace(".", ",") : String(v);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = parseIds(url.searchParams.get("ids") ?? undefined, MAX_GROUP_CELLS);
  const format = url.searchParams.get("format") ?? "geojson";
  if (!ids) return NextResponse.json({ error: `ids: 1 to ${MAX_GROUP_CELLS} unit ids, comma-separated` }, { status: 400 });
  if (format !== "geojson" && format !== "csv") return NextResponse.json({ error: "format must be geojson or csv" }, { status: 400 });

  const [set, geometries] = await Promise.all([loadUnitSet(ids), listUnitGeometries(ids)]);
  if (set.units.length === 0) return NextResponse.json({ error: "no such units" }, { status: 404 });

  const sources = sourcesUsed(set);
  const uncitable = sources.filter((s) => !isCitable(s));
  if (uncitable.length > 0) {
    return NextResponse.json(
      { error: `export refused: no Quellenvermerk for ${uncitable.map((s) => s.id).join(", ")}` },
      { status: 500 },
    );
  }
  const notices = sources.map((s) => renderAttribution(s));
  const generatedAt = new Date().toISOString();
  const methodVersions = [CURRENT_METHOD_VERSION, ...CITED_OUTCOME_METHODS.map((c) => c.method.methodVersion)];
  const stem = `sela-flaeche-${set.units.length}-zellen`;

  if (format === "csv") {
    const rows = set.units.map((reading) => ({
      ...columns(reading, geometries.get(reading.unit.id)?.ags ?? null),
      quellen: notices.join("; "),
      hinweis: ADVISORY_DE,
      stand: generatedAt.slice(0, 10),
    }));
    const header = Object.keys(rows[0]!);
    const body = [header.join(";"), ...rows.map((row) => header.map((k) => csvCell((row as Record<string, unknown>)[k])).join(";"))].join(
      "\r\n",
    );
    // A BOM so spreadsheet programs read the umlauts; semicolons, as German locales expect.
    return new Response(`﻿${body}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.csv"`,
      },
    });
  }

  const collection = {
    type: "FeatureCollection",
    sela: {
      generatedAt,
      methodVersions,
      sources: sources.map((s) => ({ id: s.id, dataset: s.dataset, publisher: s.publisher, licence: s.licence, notice: renderAttribution(s), url: s.url })),
      note: ADVISORY_DE,
      crs: "EPSG:4326 (geometry); the cells are a 100 m hexagonal grid in EPSG:25832 (ADR-0001)",
    },
    features: set.units.map((reading) => {
      const geometry = geometries.get(reading.unit.id);
      return {
        type: "Feature",
        id: reading.unit.id,
        properties: columns(reading, geometry?.ags ?? null),
        geometry: geometry?.geometry ?? null,
      };
    }),
  };
  return new Response(JSON.stringify(collection), {
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.geojson"`,
    },
  });
}
