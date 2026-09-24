"use client";

// The explorer's MapLibre instance (roadmap §5.1), driven entirely by
// Explorer.tsx: it draws what it is given and reports hovers, clicks and the
// units in view back. Map-first, chrome quiet (design-language.md §3) — the
// only chrome on the canvas itself is zoom and scale.
//
// Units arrive as vector tiles (ADR-0007): a real pilot region is ~117 000
// cells, so the browser only ever holds the ones in view. Each tile feature
// carries every technology's verdict (`v_pv`, `v_agripv`, `v_wind`), so the
// technology switch is a paint change, never a refetch.
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
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { BBox, GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import { addPattern } from "@/lib/map/patterns";
import { INTERACTIVE_MIN_ZOOM, MAX_UNIT_TILE_ZOOM, MIN_UNIT_TILE_ZOOM, UNIT_TILE_LAYER } from "@/lib/map/tiles";
import {
  INK,
  MAP_VERDICTS,
  PATTERN_MARK_COLOR,
  patternName,
  verdictAppearance,
  type MapVerdict,
} from "@/lib/map/verdict-style";
import { REAL_PILOT_REGION } from "@/lib/pilot-region";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";

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

export interface HoverInfo {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly verdict: MapVerdict;
  readonly score: number | null;
}

/** A unit currently drawn on the map, with every technology's verdict, as the list beside it needs it. */
export interface VisibleUnit {
  readonly id: string;
  readonly byTechnology: Readonly<Record<Technology, { verdict: MapVerdict; score: number | null }>>;
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

function verdictOf(technology: Technology): ExpressionSpecification {
  return ["coalesce", ["get", `v_${technology}`], "unscored"];
}

function colorExpression(technology: Technology): ExpressionSpecification {
  const cases = MAP_VERDICTS.flatMap((verdict) => [verdict, verdictAppearance(verdict, technology).color]);
  return ["match", verdictOf(technology), ...cases, verdictAppearance("unscored", technology).color] as unknown as ExpressionSpecification;
}

function patternExpression(technology: Technology): ExpressionSpecification {
  const cases = MAP_VERDICTS.filter((v) => verdictAppearance(v, technology).encoding).flatMap((verdict) => [
    verdict,
    patternName(verdict, technology),
  ]);
  return ["match", verdictOf(technology), ...cases, ""] as unknown as ExpressionSpecification;
}

function patternFilter(technology: Technology): ExpressionSpecification {
  const patterned = MAP_VERDICTS.filter((v) => verdictAppearance(v, technology).encoding);
  return ["in", verdictOf(technology), ["literal", patterned]] as unknown as ExpressionSpecification;
}

function readVerdict(properties: Record<string, unknown>, technology: Technology): { verdict: MapVerdict; score: number | null } {
  const verdict = (properties[`v_${technology}`] as MapVerdict | undefined) ?? "unscored";
  const score = properties[`s_${technology}`];
  return { verdict, score: typeof score === "number" ? score : null };
}

export function Map({
  region,
  regionBBox,
  dataAttribution,
  technology,
  selectedId,
  hoveredId,
  focus,
  framePadding,
  onSelect,
  onHover,
  onVisibleUnits,
}: {
  region: string;
  regionBBox: BBox | null;
  /** HTML notices of every source whose data the unit tiles carry (sources.md §7 condition 4). */
  dataAttribution: string;
  technology: Technology;
  selectedId: string | null;
  hoveredId: string | null;
  focus: FocusRequest | null;
  framePadding: FramePadding;
  onSelect: (id: string | null) => void;
  onHover: (hover: HoverInfo | null) => void;
  /** `null` when zoomed out beyond the tiles' range — the units exist but are not drawn. */
  onVisibleUnits: (units: VisibleUnit[] | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);
  // Set once anything has asked the map to frame something, so a late initial
  // framing can never override a selection the reader already made.
  const framedByRequestRef = useRef(false);
  // Latest props for handlers registered once at load.
  const latest = useRef({ technology, selectedId, hoveredId, framePadding, onSelect, onHover, onVisibleUnits, regionBBox });
  latest.current = { technology, selectedId, hoveredId, framePadding, onSelect, onHover, onVisibleUnits, regionBBox };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // MapLibre resolves its background worker script relative to
    // import.meta.url, which Next.js's webpack bundling doesn't preserve as
    // a loadable URL (it resolves empty, so the worker silently loads the
    // page's own HTML and dies — no source ever finishes processing and no
    // fill ever paints). Point it at the copy of the matching maplibre-gl
    // version's worker bundle in public/ instead.
    setWorkerUrl("/maplibre-gl-worker.mjs");

    const map = new MaplibreMap({
      container: containerRef.current,
      style: "/api/tiles/style.json",
      ...(regionBBox
        ? { bounds: [[regionBBox[0], regionBBox[1]], [regionBBox[2], regionBBox[3]]], fitBoundsOptions: { padding: framePadding } }
        : { center: [13.9, 53.15] as [number, number], zoom: 9 }),
      attributionControl: { compact: true },
      // The explorer is a plan view; tilting belongs to the 3D preview (ADR-0006).
      pitchWithRotate: false,
      maxPitch: 0,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    const reportVisible = () => {
      if (!loadedRef.current) return;
      // Below the interactive zoom the tiles carry no ids (lib/map/tiles.ts) —
      // the cells are texture there, not addressable units.
      if (map.getZoom() < INTERACTIVE_MIN_ZOOM) {
        latest.current.onVisibleUnits(null);
        return;
      }
      const seen = new globalThis.Map<string, VisibleUnit>();
      for (const feature of map.queryRenderedFeatures({ layers: [FILL_LAYER_ID] })) {
        if (feature.properties.id === undefined) continue;
        const id = String(feature.properties.id);
        if (seen.has(id)) continue;
        const byTechnology = Object.fromEntries(
          TECHNOLOGIES.map((tech) => [tech, readVerdict(feature.properties, tech)]),
        ) as VisibleUnit["byTechnology"];
        seen.set(id, { id, byTechnology });
      }
      latest.current.onVisibleUnits([...seen.values()].sort((a, b) => a.id.localeCompare(b.id)));
    };

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

      const t = latest.current.technology;
      map.addSource(SOURCE_ID, {
        type: "vector",
        tiles: [`${window.location.origin}/api/units/tiles/{z}/{x}/{y}?region=${encodeURIComponent(region)}`],
        minzoom: MIN_UNIT_TILE_ZOOM,
        maxzoom: MAX_UNIT_TILE_ZOOM,
        promoteId: "id",
        attribution: dataAttribution,
      });
      const common = { source: SOURCE_ID, "source-layer": UNIT_TILE_LAYER, minzoom: MIN_UNIT_TILE_ZOOM } as const;
      // Solid at the overview, where the fills are the picture; lighter as the
      // reader zooms in, so villages, roads and field edges on the basemap stay
      // visible under the unit they are looking at — orientation is the point
      // of zooming in.
      const fillOpacity: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 11, 0.88, 14, 0.5];
      map.addLayer({ id: FILL_LAYER_ID, type: "fill", ...common, paint: { "fill-color": colorExpression(t), "fill-opacity": fillOpacity } });
      map.addLayer({
        id: PATTERN_LAYER_ID,
        type: "fill",
        ...common,
        filter: patternFilter(t),
        paint: { "fill-pattern": patternExpression(t), "fill-opacity": fillOpacity },
      });
      // Paper-coloured seams: the grid reads as a mosaic of units, not as a
      // cartographic line layer competing with the data. Only once cells are
      // big enough for seams to mean anything.
      map.addLayer({
        id: EDGE_LAYER_ID,
        type: "line",
        ...common,
        minzoom: 13,
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.3, 16, 1.2] },
      });
      map.addLayer({
        id: HOVER_LAYER_ID,
        type: "line",
        ...common,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": INK, "line-width": 1.25, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: SELECTED_HALO_LAYER_ID,
        type: "line",
        ...common,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": 6 },
      });
      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "line",
        ...common,
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": INK, "line-width": 2.5 },
      });
      loadedRef.current = true;
      applySelection(map, latest.current.selectedId, latest.current.hoveredId);

      // The real region's outline, fetched rather than bundled. Only drawn for
      // the region it outlines; the fixture sits at null island.
      if (region === REAL_PILOT_REGION) {
        void fetch(PILOT_BOUNDARY_URL)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((boundary: GeoJSONFeatureCollection) => {
            if (!mapRef.current) return;
            // BKG VG25 under CC BY 4.0 — a different source and licence from
            // the basemap under it, so it owes its own notice (sources.md §3,
            // §7 condition 4). Carried in the data, so regenerating the
            // boundary cannot silently drop the credit.
            const props = boundary.features[0]?.properties as { attribution?: string; retrieved?: string } | undefined;
            const year = props?.retrieved?.slice(0, 4) ?? String(new Date().getFullYear());
            const boundaryAttribution = props?.attribution?.replaceAll("<Jahr>", year);
            map.addSource(PILOT_SOURCE_ID, {
              type: "geojson",
              data: boundary as unknown as GeoJSON.FeatureCollection,
              ...(boundaryAttribution ? { attribution: `${boundaryAttribution} (Daten verändert)` } : {}),
            });
            map.addLayer({
              id: PILOT_LAYER_ID,
              type: "line",
              source: PILOT_SOURCE_ID,
              paint: { "line-color": INK, "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.8 },
            });
          })
          .catch((error: unknown) => console.warn(`pilot boundary not shown (${String(error)})`));
      }

      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0];
        if (hit && hit.properties.id === undefined) {
          // A one-pixel cell cannot be meant precisely; take the reader to
          // where cells can be told apart instead of guessing which one.
          map.easeTo({ center: e.lngLat, zoom: INTERACTIVE_MIN_ZOOM + 0.5 });
          return;
        }
        latest.current.onSelect(hit ? String(hit.properties.id) : null);
      });
      map.on("mousemove", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        map.getCanvas().style.cursor = feature?.properties.id === undefined ? "zoom-in" : "pointer";
        if (feature && feature.properties.id !== undefined) {
          latest.current.onHover({
            id: String(feature.properties.id),
            x: e.point.x,
            y: e.point.y,
            ...readVerdict(feature.properties, latest.current.technology),
          });
        }
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        latest.current.onHover(null);
      });
      map.on("idle", reportVisible);
      reportVisible();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // Mounted once per region (Explorer keys this component by region);
    // everything after load is pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Technology changed: new paint, same tiles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", colorExpression(technology));
    map.setPaintProperty(PATTERN_LAYER_ID, "fill-pattern", patternExpression(technology));
    map.setFilter(PATTERN_LAYER_ID, patternFilter(technology));
  }, [technology]);

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
      const bbox = focus.kind === "bbox" ? focus.bbox : latest.current.regionBBox;
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
