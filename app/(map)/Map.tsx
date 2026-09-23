"use client";

// The explorer's MapLibre instance (roadmap §5.1), driven entirely by
// Explorer.tsx: it draws what it is given and reports hovers and clicks back.
// Map-first, chrome quiet (design-language.md §3) — the only chrome on the
// canvas itself is zoom, compass and scale.
//
// Every verdict class carries a pattern as well as a colour (lib/map/
// verdict-style.ts), so the map is as legible in greyscale as the legend
// beside it (design-language.md §4.3 obligation 1).

import {
  Map as MaplibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { BBox, GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import { addPattern } from "@/lib/map/patterns";
import {
  INK,
  MAP_VERDICTS,
  PATTERN_MARK_COLOR,
  patternName,
  verdictAppearance,
  type MapVerdict,
} from "@/lib/map/verdict-style";
import { TECHNOLOGIES, type SuitabilityVerdict, type Technology } from "@/lib/scoring/types";

const SOURCE_ID = "units";
const FILL_LAYER_ID = "units-fill";
const PATTERN_LAYER_ID = "units-pattern";
const EDGE_LAYER_ID = "units-edge";
const HOVER_LAYER_ID = "units-hover";
const SELECTED_HALO_LAYER_ID = "units-selected-halo";
const SELECTED_LAYER_ID = "units-selected";
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

export interface HoverInfo {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** A request to frame something; `nonce` makes repeated requests for the same target still fire. */
export type FocusRequest =
  | { readonly kind: "bbox"; readonly bbox: BBox; readonly nonce: number }
  | { readonly kind: "region"; readonly nonce: number };

/** Padding that keeps a framed target clear of the floating panels. */
export interface FramePadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

// lib/db/queries/spatial-units.ts types its GeoJSON readonly; MapLibre's
// @types/geojson is mutable. The data is never mutated, so the cast is only
// about array variance.
function withVerdicts(units: GeoJSONFeatureCollection, verdicts: readonly SuitabilityVerdict[]): GeoJSON.FeatureCollection {
  const byUnit = new globalThis.Map(verdicts.map((v) => [v.spatialUnitId, v]));
  return {
    type: "FeatureCollection" as const,
    features: units.features.map((feature) => {
      const verdict = byUnit.get(feature.id);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          verdict: (verdict?.verdict ?? "unscored") satisfies MapVerdict,
          score: verdict?.score ?? null,
        },
      };
    }),
  } as unknown as GeoJSON.FeatureCollection;
}

function colorExpression(technology: Technology): ExpressionSpecification {
  const cases = MAP_VERDICTS.flatMap((verdict) => [verdict, verdictAppearance(verdict, technology).color]);
  return ["match", ["get", "verdict"], ...cases, verdictAppearance("unscored", technology).color] as unknown as ExpressionSpecification;
}

function patternExpression(technology: Technology): ExpressionSpecification {
  const cases = MAP_VERDICTS.filter((v) => verdictAppearance(v, technology).encoding).flatMap((verdict) => [
    verdict,
    patternName(verdict, technology),
  ]);
  return ["match", ["get", "verdict"], ...cases, ""] as unknown as ExpressionSpecification;
}

function patternFilter(technology: Technology): ExpressionSpecification {
  const patterned = MAP_VERDICTS.filter((v) => verdictAppearance(v, technology).encoding);
  return ["in", ["get", "verdict"], ["literal", patterned]] as unknown as ExpressionSpecification;
}

export function Map({
  units,
  verdicts,
  technology,
  selectedId,
  hoveredId,
  focus,
  framePadding,
  onSelect,
  onHover,
}: {
  units: GeoJSONFeatureCollection;
  verdicts: readonly SuitabilityVerdict[];
  technology: Technology;
  selectedId: string | null;
  hoveredId: string | null;
  focus: FocusRequest | null;
  framePadding: FramePadding;
  onSelect: (id: string | null) => void;
  onHover: (hover: HoverInfo | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);
  const regionBBoxRef = useRef<BBox | null>(null);
  // Set once anything has asked the map to frame something. The boundary's own initial framing
  // arrives asynchronously and must never override a selection the reader already made.
  const framedByRequestRef = useRef(false);
  // Latest props for handlers registered once at load.
  const latest = useRef({ units, verdicts, technology, selectedId, hoveredId, framePadding, onSelect, onHover });
  latest.current = { units, verdicts, technology, selectedId, hoveredId, framePadding, onSelect, onHover };

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
      // The explorer is a plan view; tilting belongs to the 3D preview (ADR-0006).
      pitchWithRotate: false,
      maxPitch: 0,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    map.on("load", () => {
      // Quieter than the shared style: in the explorer the basemap is only
      // orientation, and every step of contrast taken from it is given to
      // the data (design-language.md §4.1). The 3D preview keeps it at full
      // strength, where the ground itself is the subject.
      if (map.getLayer("basemap-raster")) map.setPaintProperty("basemap-raster", "raster-opacity", 0.72);
      for (const tech of TECHNOLOGIES) {
        for (const verdict of MAP_VERDICTS) {
          const appearance = verdictAppearance(verdict, tech);
          if (appearance.encoding) {
            addPattern(map, patternName(verdict, tech), appearance.encoding, appearance.color, PATTERN_MARK_COLOR);
          }
        }
      }

      const { units: u, verdicts: v, technology: t } = latest.current;
      map.addSource(SOURCE_ID, { type: "geojson", data: withVerdicts(u, v), promoteId: "id" });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": colorExpression(t), "fill-opacity": 0.92 },
      });
      map.addLayer({
        id: PATTERN_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        filter: patternFilter(t),
        paint: { "fill-pattern": patternExpression(t), "fill-opacity": 0.92 },
      });
      // Paper-coloured seams: the grid reads as a mosaic of units, not as a
      // cartographic line layer competing with the data.
      map.addLayer({
        id: EDGE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.3, 16, 1.2] },
      });
      map.addLayer({
        id: HOVER_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": INK, "line-width": 1.25, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: SELECTED_HALO_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": 6 },
      });
      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": INK, "line-width": 2.5 },
      });
      loadedRef.current = true;
      applySelection(map, latest.current.selectedId, latest.current.hoveredId);

      // Real geography, fetched rather than bundled: 30 KB of boundary has no
      // business in the JS payload. A failure here is non-fatal — the map is
      // still usable without the outline, so it warns and carries on rather
      // than taking the explorer down.
      void fetch(PILOT_BOUNDARY_URL)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((boundary: GeoJSONFeatureCollection & { bbox?: number[] }) => {
          if (!mapRef.current) return;
          // The boundary is BKG VG25 under CC BY 4.0 — a different source
          // and a different licence from the basemap under it, so it owes
          // its own notice (sources.md §3, §7 condition 4). MapLibre
          // aggregates `attribution` across sources, so declaring it here
          // puts it in the same control as the basemap's rather than
          // needing separate chrome. Carried in the data rather than
          // hard-coded, so regenerating the boundary cannot silently drop
          // the credit.
          const props = boundary.features[0]?.properties as
            | { attribution?: string; retrieved?: string }
            | undefined;
          const year = props?.retrieved?.slice(0, 4) ?? String(new Date().getFullYear());
          const boundaryAttribution = props?.attribution?.replaceAll("<Jahr>", year);
          map.addSource(PILOT_SOURCE_ID, {
            type: "geojson",
            data: boundary as unknown as GeoJSON.FeatureCollection,
            ...(boundaryAttribution ? { attribution: `${boundaryAttribution} (Daten verändert)` } : {}),
          });
          map.addLayer(
            {
              id: PILOT_LAYER_ID,
              type: "line",
              source: PILOT_SOURCE_ID,
              paint: { "line-color": INK, "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.8 },
            },
            FILL_LAYER_ID,
          );
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
            regionBBoxRef.current = [west, south, east, north];
            if (!showFixtureView && !framedByRequestRef.current) {
              frame(map, regionBBoxRef.current, latest.current.framePadding, false);
            }
          }
        })
        .catch((error: unknown) => {
          console.warn(`pilot boundary not shown (${String(error)})`);
        });

      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0];
        latest.current.onSelect(hit?.id !== undefined ? String(hit.id) : null);
      });
      map.on("mousemove", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.id;
        map.getCanvas().style.cursor = "pointer";
        if (id !== undefined) latest.current.onHover({ id: String(id), x: e.point.x, y: e.point.y });
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        latest.current.onHover(null);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // Mounted once; everything after load is pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verdicts or technology changed: new data, new paint.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(withVerdicts(units, verdicts));
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", colorExpression(technology));
    map.setPaintProperty(PATTERN_LAYER_ID, "fill-pattern", patternExpression(technology));
    map.setFilter(PATTERN_LAYER_ID, patternFilter(technology));
  }, [units, verdicts, technology]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    applySelection(map, selectedId, hoveredId);
  }, [selectedId, hoveredId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    framedByRequestRef.current = true;
    const run = () => {
      const bbox = focus.kind === "bbox" ? focus.bbox : regionBBoxRef.current;
      if (bbox) frame(map, bbox, latest.current.framePadding, true, focus.kind === "bbox" ? 15.5 : undefined);
    };
    if (loadedRef.current) run();
    else map.once("load", run);
  }, [focus]);

  // MapLibre gives its canvas a label and keyboard panning of its own; the
  // unit list beside it is the keyboard path to *selection* (§9).
  // MapLibre sets `position: relative` on its container, so the absolute
  // full-bleed box has to be a wrapper around it rather than the container itself.
  return (
    <div className="map-canvas">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function applySelection(map: MaplibreMap, selectedId: string | null, hoveredId: string | null) {
  map.setFilter(HOVER_LAYER_ID, ["==", ["get", "id"], hoveredId ?? ""]);
  map.setFilter(SELECTED_HALO_LAYER_ID, ["==", ["get", "id"], selectedId ?? ""]);
  map.setFilter(SELECTED_LAYER_ID, ["==", ["get", "id"], selectedId ?? ""]);
}

function frame(map: MaplibreMap, bbox: BBox, padding: FramePadding, animate: boolean, maxZoom?: number) {
  const [west, south, east, north] = bbox;
  // MapLibre honours prefers-reduced-motion for non-essential animations itself.
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    // `maxZoom: undefined` is not the same as leaving it out — MapLibre reads it as NaN.
    { padding, animate, duration: 900, ...(maxZoom !== undefined ? { maxZoom } : {}) },
  );
}
