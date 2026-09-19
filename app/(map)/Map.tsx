"use client";

// Map explorer's MapLibre instance (roadmap §5.1). Colours each unit's fill
// by its current suitability verdict for the selected technology, using
// MapLibre feature-state so switching technology doesn't require re-adding
// the GeoJSON source. Map-first, chrome quiet (design-language.md §3): the
// only chrome here is the technology switch and the always-present keyboard
// list (UnitList.tsx) satisfying §9's "reachable without a mouse" floor.

import {
  Map as MaplibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { scenarioTokens, technologyToTokenKey } from "@/lib/design/tokens";
import type { GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import { TECHNOLOGIES, type SuitabilityVerdict, type Technology } from "@/lib/scoring/types";

const SOURCE_ID = "units";
const FILL_LAYER_ID = "units-fill";
const OUTLINE_LAYER_ID = "units-outline";
const PILOT_SOURCE_ID = "pilot-boundary";
const PILOT_LAYER_ID = "pilot-boundary-line";

// Display-only outline of the pilot region (Landkreis Uckermark), generated
// by ingest/02c_pilot_boundary_display.sh. Deliberately *not* an analysis
// input — 04_generate_grid.sql clips against the full-precision EPSG:25832
// file in ingest/pilot/, never this simplified WGS84 one.
const PILOT_BOUNDARY_URL = "/pilot-uckermark.geojson";

// The synthetic fixture cells sit at "null island" (0,0), a whole hemisphere
// from the real pilot region, so one initial view cannot show both. Default
// to the real region now that there is a basemap under it; set
// NEXT_PUBLIC_MAP_VIEW=fixture to get the 0.3.0 demo view back.
const FIXTURE_VIEW = { center: [0.005, 0.005] as [number, number], zoom: 15 };
const UNSUITABLE_COLOR = "#d8d5cc";
const EXCLUDED_COLOR = "#8a8a8a";
const UNSCORED_COLOR = "#cccccc";

// MapLibre paint expressions can't read CSS custom properties, so verdict
// colours are resolved to the light-mode hex here — dark-mode map theming
// is a known follow-up, not attempted in this pass.
function verdictColor(verdict: SuitabilityVerdict["verdict"], technology: Technology): string {
  if (verdict === "excluded") return EXCLUDED_COLOR;
  if (verdict === "unsuitable") return UNSUITABLE_COLOR;
  return scenarioTokens[technologyToTokenKey[technology]].light;
}

const TECHNOLOGY_LABEL_DE: Record<Technology, string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

export function Map({
  initialUnits,
  initialVerdicts,
  initialTechnology,
}: {
  initialUnits: GeoJSONFeatureCollection;
  initialVerdicts: SuitabilityVerdict[];
  initialTechnology: Technology;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const router = useRouter();
  const [technology, setTechnology] = useState<Technology>(initialTechnology);

  function applyVerdicts(verdicts: SuitabilityVerdict[], tech: Technology) {
    const map = mapRef.current;
    if (!map) return;
    for (const feature of initialUnits.features) {
      map.setFeatureState({ source: SOURCE_ID, id: feature.id }, { fillColor: UNSCORED_COLOR });
    }
    for (const verdict of verdicts) {
      map.setFeatureState(
        { source: SOURCE_ID, id: verdict.spatialUnitId },
        { fillColor: verdictColor(verdict.verdict, tech), verdict: verdict.verdict, score: verdict.score },
      );
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // MapLibre resolves its background worker script relative to
    // import.meta.url, which Next.js's webpack bundling doesn't preserve as
    // a loadable URL (it resolves empty, so the worker silently loads the
    // page's own HTML and dies — the GeoJSON source then never finishes
    // processing and no fill ever paints). Point it at the copy of the
    // matching maplibre-gl version's worker bundle in public/ instead.
    setWorkerUrl("/maplibre-gl-worker.mjs");

    const showFixtureView = process.env.NEXT_PUBLIC_MAP_VIEW === "fixture";
    const map = new MaplibreMap({
      container: containerRef.current,
      style: "/api/tiles/style.json",
      center: FIXTURE_VIEW.center,
      zoom: FIXTURE_VIEW.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, { type: "geojson", data: initialUnits, promoteId: "id" });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": ["coalesce", ["feature-state", "fillColor"], UNSCORED_COLOR],
          "fill-opacity": 0.75,
        },
      });
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#54524c", "line-width": 0.5 },
      });

      applyVerdicts(initialVerdicts, initialTechnology);

      // Real geography, fetched rather than bundled: 30 KB of boundary has no
      // business in the JS payload. A failure here is non-fatal — the map is
      // still usable without the outline, so it warns and carries on rather
      // than taking the explorer down.
      if (!showFixtureView) {
        void fetch(PILOT_BOUNDARY_URL)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((boundary: GeoJSONFeatureCollection & { bbox?: number[] }) => {
            if (!mapRef.current) return;
            map.addSource(PILOT_SOURCE_ID, { type: "geojson", data: boundary });
            map.addLayer({
              id: PILOT_LAYER_ID,
              type: "line",
              source: PILOT_SOURCE_ID,
              paint: { "line-color": "#54524c", "line-width": 1.5, "line-dasharray": [3, 2] },
            });
            // A length check doesn't narrow number[] to a 4-tuple, so the
            // corners are pulled out and checked individually rather than
            // asserted with a cast.
            const [west, south, east, north] = boundary.bbox ?? [];
            if (
              typeof west === "number" &&
              typeof south === "number" &&
              typeof east === "number" &&
              typeof north === "number"
            ) {
              map.fitBounds(
                [
                  [west, south],
                  [east, north],
                ],
                { padding: 40, animate: false },
              );
            }
          })
          .catch((error: unknown) => {
            console.warn(`pilot boundary not shown (${String(error)})`);
          });
      }

      map.on("click", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.id;
        if (id !== undefined) router.push(`/unit/${id}`);
      });
      map.on("mouseenter", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Initial data only — technology switches are applied via feature-state, not a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTechnologyChange(next: Technology) {
    setTechnology(next);
    const response = await fetch(`/api/units/verdicts?technology=${next}`);
    if (!response.ok) return;
    const verdicts: SuitabilityVerdict[] = await response.json();
    applyVerdicts(verdicts, next);
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div
        role="group"
        aria-label="Technologie für die Kartenfärbung"
        style={{
          position: "absolute",
          top: "0.75rem",
          left: "0.75rem",
          zIndex: 1,
          display: "flex",
          gap: "0.4rem",
          background: "var(--surface-1)",
          padding: "0.4rem",
          borderRadius: "0.4rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        {TECHNOLOGIES.map((tech) => (
          <button
            key={tech}
            type="button"
            aria-pressed={technology === tech}
            onClick={() => handleTechnologyChange(tech)}
            style={{
              padding: "0.3rem 0.6rem",
              borderRadius: "0.3rem",
              border: technology === tech ? "2px solid var(--text-primary)" : "1px solid var(--text-secondary)",
              background: "transparent",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            {TECHNOLOGY_LABEL_DE[tech]}
          </button>
        ))}
      </div>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
