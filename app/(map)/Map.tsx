"use client";

// The explorer's MapLibre instance (roadmap §5.1), driven entirely by
// Explorer.tsx: it draws what it is given and reports hovers, clicks, the
// view and the units in view back. Map-first, chrome quiet (design-language.md
// §3) — the only chrome on the canvas itself is zoom and scale.
//
// Units arrive as vector tiles (ADR-0007, ADR-0012): a Land is a million
// cells, so below the cell zoom the tiles carry the overview pyramid — 1 km
// and 5 km hexagons in the colour of their most frequent class — and from the
// cell zoom the cells themselves. Both carry every technology's verdict under
// the same keys (`v_pv`, `v_agripv`, `v_wind`), so the technology switch is a
// paint change, never a refetch, and one set of paint rules serves both.
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
import type { BBox } from "@/lib/db/queries/spatial-units";
import { parseView, type MapView } from "@/lib/explorer-url";
import { addPattern } from "@/lib/map/patterns";
import {
  INTERACTIVE_MIN_ZOOM,
  MAX_UNIT_TILE_ZOOM,
  MIN_UNIT_TILE_ZOOM,
  UNIT_TILE_LAYER,
  zoomTargetAfterClick,
} from "@/lib/map/tiles";
import {
  INK,
  MAP_VERDICTS,
  PATTERN_MARK_COLOR,
  patternName,
  verdictAppearance,
  type MapVerdict,
} from "@/lib/map/verdict-style";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";

const SOURCE_ID = "units";
const FILL_LAYER_ID = "units-fill";
const PATTERN_LAYER_ID = "units-pattern";
const EDGE_LAYER_ID = "units-edge";
const FLAG_LAYER_ID = "units-flag";
const HOVER_LAYER_ID = "units-hover";
const SELECTED_HALO_LAYER_ID = "units-selected-halo";
const SELECTED_LAYER_ID = "units-selected";
const GROUP_FILL_LAYER_ID = "units-group-fill";
const GROUP_LAYER_ID = "units-group";
const OUTLINE_SOURCE_ID = "municipality-outline";
const OUTLINE_LAYER_ID = "municipality-outline-line";
const REGION_SOURCE_ID = "region-boundary";
const REGION_LAYER_ID = "region-boundary-line";

export interface HoverInfo {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly verdict: MapVerdict;
  readonly score: number | null;
  /** Set when the hovered feature is an overview hexagon, not a cell (ADR-0012). */
  readonly overview: { readonly levelM: number; readonly n: number; readonly share: number } | null;
}

/** A unit currently drawn on the map, with every technology's verdict, as the list beside it needs it. */
export interface VisibleUnit {
  readonly id: string;
  readonly byTechnology: Readonly<Record<Technology, { verdict: MapVerdict; score: number | null }>>;
}

/** A request to frame something; `nonce` makes repeated requests for the same target still fire. */
export type FocusRequest =
  | { readonly kind: "bbox"; readonly bbox: BBox; readonly nonce: number; readonly maxZoom?: number }
  | { readonly kind: "region"; readonly nonce: number };

/** A Gemeinde outline found by search (flow F1), as /api/municipality/[ags] returns it. */
export interface MapOutline {
  readonly type: "Feature";
  readonly id: string;
  readonly properties: { readonly name: string; readonly attribution: string | null };
  readonly geometry: unknown;
}

/**
 * What the map draws (roadmap-planning-tool.md Phase 3): only these classes,
 * only cells without a Prüfhinweis. A filter on the paint — the legend's
 * counts never change with it.
 */
export interface MapFilter {
  readonly onlyClasses: readonly MapVerdict[] | null;
  readonly withoutFlags: boolean;
}

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

/** The reader's filter as a MapLibre expression: which classes, and whether flagged cells are left out. */
function readerFilter(technology: Technology, filter: MapFilter): ExpressionSpecification[] {
  const terms: ExpressionSpecification[] = [];
  if (filter.onlyClasses) terms.push(["in", verdictOf(technology), ["literal", [...filter.onlyClasses]]] as unknown as ExpressionSpecification);
  // Below the interactive zoom tiles carry no `h_*`; `!= true` keeps those cells.
  if (filter.withoutFlags && technology !== "wind") terms.push(["!=", ["get", `h_${technology}`], true] as unknown as ExpressionSpecification);
  return terms;
}

function fillFilter(technology: Technology, filter: MapFilter): ExpressionSpecification {
  return ["all", ...readerFilter(technology, filter)] as unknown as ExpressionSpecification;
}

function patternFilter(technology: Technology, filter: MapFilter): ExpressionSpecification {
  const patterned = MAP_VERDICTS.filter((v) => verdictAppearance(v, technology).encoding);
  return ["all", ["in", verdictOf(technology), ["literal", patterned]], ...readerFilter(technology, filter)] as unknown as ExpressionSpecification;
}

/** Cells carrying at least one Prüfhinweis for this technology (ADR-0009); tiles carry `h_*` from z12. */
function flagFilter(technology: Technology, filter: MapFilter): ExpressionSpecification {
  return ["all", ["==", ["get", `h_${technology}`], true], ...readerFilter(technology, filter)] as unknown as ExpressionSpecification;
}

function readVerdict(properties: Record<string, unknown>, technology: Technology): { verdict: MapVerdict; score: number | null } {
  const verdict = (properties[`v_${technology}`] as MapVerdict | undefined) ?? "unscored";
  const score = properties[`s_${technology}`];
  return { verdict, score: typeof score === "number" ? score : null };
}

export function Map({
  region,
  showBoundary,
  regionBBox,
  dataAttribution,
  technology,
  selectedId,
  hoveredId,
  focus,
  framePadding,
  groupIds,
  outline,
  filter,
  onSelect,
  onToggleGroup,
  onHover,
  onVisibleUnits,
  onViewChange,
}: {
  region: string;
  /** Whether to draw the region's boundary (real regions; the fixture has none). */
  showBoundary: boolean;
  regionBBox: BBox | null;
  /** HTML notices of every source whose data the unit tiles carry (sources.md §7 condition 4). */
  dataAttribution: string;
  technology: Technology;
  selectedId: string | null;
  hoveredId: string | null;
  focus: FocusRequest | null;
  framePadding: FramePadding;
  /** Cells chosen together (roadmap Step 5). */
  groupIds: readonly string[];
  /** The Gemeinde found by search, outlined; null for none. */
  outline: MapOutline | null;
  filter: MapFilter;
  onSelect: (id: string | null) => void;
  /** Shift-click (or Ctrl/⌘-click) adds a cell to the group or removes it. */
  onToggleGroup: (id: string) => void;
  onHover: (hover: HoverInfo | null) => void;
  /** `null` when zoomed out beyond the interactive zoom — the units exist but are not addressable. */
  onVisibleUnits: (units: VisibleUnit[] | null) => void;
  /** After every move: zoom and centre, for the URL and the legend's overview note. */
  onViewChange: (view: MapView) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);
  // Set once anything has asked the map to frame something, so a late initial
  // framing can never override a selection the reader already made.
  const framedByRequestRef = useRef(false);
  // Latest props for handlers registered once at load.
  const latest = useRef({ technology, selectedId, hoveredId, groupIds, framePadding, filter, onSelect, onToggleGroup, onHover, onVisibleUnits, onViewChange, regionBBox });
  latest.current = { technology, selectedId, hoveredId, groupIds, framePadding, filter, onSelect, onToggleGroup, onHover, onVisibleUnits, onViewChange, regionBBox };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // MapLibre resolves its background worker script relative to
    // import.meta.url, which Next.js's webpack bundling doesn't preserve as
    // a loadable URL (it resolves empty, so the worker silently loads the
    // page's own HTML and dies — no source ever finishes processing and no
    // fill ever paints). Point it at the copy of the matching maplibre-gl
    // version's worker bundle in public/ instead.
    setWorkerUrl("/maplibre-gl-worker.mjs");

    // The view a link carried (lib/explorer-url.ts) wins over framing the
    // region. Read here, in the mount effect, so it never reaches the server render.
    const initialView = parseView(new URLSearchParams(window.location.search).get("v"));

    const map = new MaplibreMap({
      container: containerRef.current,
      style: "/api/tiles/style.json",
      ...(initialView
        ? { center: [initialView.lng, initialView.lat] as [number, number], zoom: initialView.zoom }
        : regionBBox
          ? { bounds: [[regionBBox[0], regionBBox[1]], [regionBBox[2], regionBBox[3]]], fitBoundsOptions: { padding: framePadding } }
          : { center: [13.4, 52.0] as [number, number], zoom: 6 }),
      attributionControl: { compact: true },
      // The explorer is a plan view; tilting belongs to the 3D preview (ADR-0006).
      pitchWithRotate: false,
      maxPitch: 0,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    const reportView = () => {
      const centre = map.getCenter();
      latest.current.onViewChange({ zoom: map.getZoom(), lat: centre.lat, lng: centre.lng });
    };

    const reportVisible = () => {
      if (!loadedRef.current) return;
      // Below the interactive zoom the tiles carry no ids (lib/map/tiles.ts) —
      // the cells are texture or overview there, not addressable units.
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
      const f = latest.current.filter;
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
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        ...common,
        filter: fillFilter(t, f),
        paint: { "fill-color": colorExpression(t), "fill-opacity": fillOpacity },
      });
      map.addLayer({
        id: PATTERN_LAYER_ID,
        type: "fill",
        ...common,
        filter: patternFilter(t, f),
        paint: { "fill-pattern": patternExpression(t), "fill-opacity": fillOpacity },
      });
      // Prüfhinweise (ADR-0009): a dashed ink contour on cells that carry at
      // least one — a thing to check, drawn as a line so it never competes with
      // the class fill and its pattern (design-language.md §8). From z12, where
      // tiles carry the flag and a cell is large enough for a contour to read.
      map.addLayer({
        id: FLAG_LAYER_ID,
        type: "line",
        ...common,
        minzoom: INTERACTIVE_MIN_ZOOM,
        filter: flagFilter(t, f),
        paint: {
          "line-color": INK,
          "line-opacity": 0.75,
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 1.6],
          "line-dasharray": [2, 1.5],
        },
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
      // Cells chosen together: an ink wash under a solid ink edge — distinct
      // from the single selection's paper halo and from the dashed Prüfhinweis
      // contour, and legible in greyscale (design-language.md §4.3).
      map.addLayer({
        id: GROUP_FILL_LAYER_ID,
        type: "fill",
        ...common,
        filter: groupFilter([]),
        paint: { "fill-color": INK, "fill-opacity": 0.22 },
      });
      map.addLayer({
        id: GROUP_LAYER_ID,
        type: "line",
        ...common,
        filter: groupFilter([]),
        paint: { "line-color": INK, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 16, 2.5] },
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
      applyGroup(map, latest.current.groupIds);

      // The region's outline (ADR-0012), from the region row the ingest wrote.
      // BKG VG25 under CC BY 4.0 — a different source and licence from the
      // basemap under it, so it owes its own notice (sources.md §3, §7
      // condition 4), carried in the response.
      if (showBoundary) {
        void fetch(`/api/region/${encodeURIComponent(region)}/outline`)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((boundary: MapOutline) => {
            if (!mapRef.current) return;
            map.addSource(REGION_SOURCE_ID, {
              type: "geojson",
              data: boundary as unknown as GeoJSON.Feature,
              ...(boundary.properties.attribution ? { attribution: `${boundary.properties.attribution} (Daten verändert)` } : {}),
            });
            map.addLayer({
              id: REGION_LAYER_ID,
              type: "line",
              source: REGION_SOURCE_ID,
              paint: { "line-color": INK, "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.8 },
            });
          })
          .catch((error: unknown) => console.warn(`region boundary not shown (${String(error)})`));
      }

      map.on("click", (e) => {
        const hit = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0];
        if (hit && hit.properties.id === undefined) {
          // A one-pixel cell or an overview hexagon cannot be meant precisely;
          // take the reader a band closer instead of guessing which cell.
          map.easeTo({ center: e.lngLat, zoom: zoomTargetAfterClick(map.getZoom()) });
          return;
        }
        const modified = e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey;
        if (hit && modified) {
          latest.current.onToggleGroup(String(hit.properties.id));
          return;
        }
        latest.current.onSelect(hit ? String(hit.properties.id) : null);
      });
      map.on("mousemove", FILL_LAYER_ID, (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as Record<string, unknown>;
        map.getCanvas().style.cursor = props.id === undefined ? "zoom-in" : "pointer";
        const tech = latest.current.technology;
        if (props.id !== undefined) {
          latest.current.onHover({ id: String(props.id), x: e.point.x, y: e.point.y, ...readVerdict(props, tech), overview: null });
        } else if (typeof props.lvl === "number") {
          const share = props[`p_${tech}`];
          latest.current.onHover({
            id: "",
            x: e.point.x,
            y: e.point.y,
            ...readVerdict(props, tech),
            overview: { levelM: props.lvl, n: Number(props.n ?? 0), share: typeof share === "number" ? share : 0 },
          });
        } else {
          latest.current.onHover(null);
        }
      });
      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        latest.current.onHover(null);
      });
      map.on("idle", reportVisible);
      map.on("moveend", reportView);
      reportVisible();
      reportView();
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

  // Technology or filter changed: new paint and filters, same tiles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", colorExpression(technology));
    map.setPaintProperty(PATTERN_LAYER_ID, "fill-pattern", patternExpression(technology));
    map.setFilter(FILL_LAYER_ID, fillFilter(technology, filter));
    map.setFilter(PATTERN_LAYER_ID, patternFilter(technology, filter));
    map.setFilter(FLAG_LAYER_ID, flagFilter(technology, filter));
  }, [technology, filter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    applySelection(map, selectedId, hoveredId);
  }, [selectedId, hoveredId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    applyGroup(map, groupIds);
  }, [groupIds]);

  // The Gemeinde found by search: one outline at a time, replaced on the next search.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => {
      if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
      if (map.getSource(OUTLINE_SOURCE_ID)) map.removeSource(OUTLINE_SOURCE_ID);
      if (!outline) return;
      map.addSource(OUTLINE_SOURCE_ID, {
        type: "geojson",
        data: outline as unknown as GeoJSON.Feature,
        ...(outline.properties.attribution ? { attribution: outline.properties.attribution } : {}),
      });
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: OUTLINE_SOURCE_ID,
        paint: { "line-color": INK, "line-width": 2.25, "line-opacity": 0.9 },
      });
    };
    if (loadedRef.current) run();
    else map.once("load", run);
  }, [outline]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    framedByRequestRef.current = true;
    const run = () => {
      const bbox = focus.kind === "bbox" ? focus.bbox : latest.current.regionBBox;
      if (bbox) frame(map, bbox, latest.current.framePadding, true, focus.kind === "bbox" ? (focus.maxZoom ?? 15.5) : undefined);
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

function groupFilter(ids: readonly string[]): ExpressionSpecification {
  return ["in", ["get", "id"], ["literal", [...ids]]] as unknown as ExpressionSpecification;
}

function applyGroup(map: MaplibreMap, ids: readonly string[]) {
  map.setFilter(GROUP_FILL_LAYER_ID, groupFilter(ids));
  map.setFilter(GROUP_LAYER_ID, groupFilter(ids));
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
