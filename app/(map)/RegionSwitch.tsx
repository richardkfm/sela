"use client";

// Where the reader is, and how to get elsewhere (ADR-0012): the Länder sela
// holds as buttons, the Landkreise of the current Land as one select — a
// Land has up to eighteen, too many for buttons in a quiet panel — and the
// way back to the whole Land. The synthetic fixture stays reachable as a
// tertiary link, never beside the real regions as if it were one.

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RegionNode, RegionSummary } from "@/lib/db/queries/regions";

const COUNT = new Intl.NumberFormat("de-DE");

export function RegionSwitch({ region, regions }: { region: RegionSummary; regions: readonly RegionNode[] }) {
  const router = useRouter();
  const laender = regions.filter((r) => r.level === "land");
  const fixtures = regions.filter((r) => r.level === "fixture");
  // Landkreise shown on their own grid (an install that holds only the
  // Uckermark) belong under their Land even when the Land has no cells.
  const orphanKreise = regions.filter((r) => r.level === "kreis" && !laender.some((l) => l.id === r.parentId));
  const landId = region.level === "land" ? region.id : region.parent?.id ?? null;
  const kreise = region.level === "land" ? region.children : region.parent ? regions.filter((r) => r.parentId === region.parent?.id) : [];
  const landHasCells = laender.some((l) => l.id === landId);

  return (
    <section aria-labelledby="region-heading" className="explorer-section">
      <h2 id="region-heading" className="overline">
        Gebiet
      </h2>
      {(laender.length > 0 || orphanKreise.length > 0) && (
        <div className="explorer-views" role="group" aria-label="Bundesland">
          {laender.map((land) => (
            <Link
              key={land.id}
              className="btn btn-small"
              href={`/?region=${land.id}`}
              aria-current={land.id === region.id ? "page" : undefined}
            >
              {land.nameDe}
            </Link>
          ))}
          {orphanKreise.map((kreis) => (
            <Link
              key={kreis.id}
              className="btn btn-small"
              href={`/?region=${kreis.id}`}
              aria-current={kreis.id === region.id ? "page" : undefined}
            >
              {kreis.bez ?? "Landkreis"} {kreis.nameDe}
            </Link>
          ))}
        </div>
      )}
      {(kreise.length > 1 || landHasCells) && (
        <div className="region-select">
          <label htmlFor="kreis-select" className="visually-hidden">
            Landkreis oder kreisfreie Stadt
          </label>
          <select
            id="kreis-select"
            value={region.level === "kreis" ? region.id : ""}
            onChange={(event) => router.push(`/?region=${event.target.value || landId}`)}
          >
            <option value="">{landHasCells ? `Ganz ${region.level === "land" ? region.nameDe : region.parent?.nameDe}` : "Landkreis wählen …"}</option>
            {kreise.map((kreis) => (
              <option key={kreis.id} value={kreis.id}>
                {kreis.nameDe} ({kreis.bez ?? "Landkreis"}, {COUNT.format(kreis.unitCount)} Zellen)
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="explorer-note muted">
        {region.level === "fixture"
          ? `Die ${COUNT.format(region.unitCount)} Beispielflächen liegen bewusst bei 0° N 0° O, damit sie nicht mit einem echten Ort verwechselt werden.`
          : `${COUNT.format(region.unitCount)} Rasterzellen à 100 m (2,6 ha) über ${region.level === "land" ? `das ganze Land ${region.nameDe}` : `den ${region.bez ?? "Landkreis"} ${region.nameDe}`}. Die Messwerte sind echt; eingeordnet wird nach veröffentlichten Regeln, ohne Punktzahl.`}
        {fixtures.length > 0 && region.level !== "fixture" && (
          <>
            {" "}
            <Link href={`/?region=${fixtures[0]!.id}`}>Beispieldatensatz →</Link>
          </>
        )}
      </p>
    </section>
  );
}
