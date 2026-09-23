"use client";

// The 3D scene of the parcel preview (ADR-0006): MapLibre draws the ground —
// basemap, terrain, the unit and its neighbours, the setback rings, all draped
// on the relief — and deck.gl, interleaved into the same WebGL context, draws
// the true-scale models on top of it, depth-tested against the terrain.
//
// Positions arrive finished from PostGIS (lib/db/queries/preview.ts). The only
// thing this file adds to them is the ground height under each one, read back
// from MapLibre's terrain — a lookup into the displayed DEM, not a computation
// on it, and used for placement only (ADR-0002).

import { AmbientLight, DirectionalLight, LightingEffect, type Layer } from "@deck.gl/core";
import { TextLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import {
  LngLat,
  Map as MaplibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import type { PreviewRing, PreviewRow, PreviewUnit } from "@/lib/db/queries/preview";
import { addPattern } from "@/lib/map/patterns";
import {
  INK,
  MAP_VERDICTS,
  PATTERN_MARK_COLOR,
  patternName,
  verdictAppearance,
} from "@/lib/map/verdict-style";
import {
  moduleTableCentreHeightM,
  moduleTableMesh,
  postMesh,
  rotorMesh,
  rotorOverhangM,
  turbineBodyMesh,
} from "@/lib/preview/meshes";
import { AGRIPV_LAYOUT, EYE_HEIGHT_M, PV_LAYOUT, SETBACK_RINGS, totalHeightM } from "@/lib/preview/reference-geometry";
import type { Technology } from "@/lib/scoring/types";

export type SceneTechnology = Technology | "status_quo";

export interface PreviewData {
  unit: PreviewUnit;
  technology: Technology;
  turbine: { hubHeightM: number; rotorDiameterM: number };
  neighbours: GeoJSONFeatureCollection;
  rows: PreviewRow[];
  rings: (Partial<PreviewRing> & { id: string; radiusM: number })[];
  jurisdiction: { asIfIn: string | null } | null;
}

/** A camera request; `nonce` lets the same view be requested twice. */
export type ViewRequest =
  | { kind: "overview"; nonce: number }
  | { kind: "close"; nonce: number }
  | { kind: "eye"; ringId: string; bearingDeg: number; nonce: number };

// Materials: an architect's model, not a product render (design-language.md §2a).
// Light enough to read as an unpainted model, dark enough to stand off paper-coloured ground.
const TURBINE_COLOR: [number, number, number] = [214, 212, 205];
const TABLE_COLOR: [number, number, number] = [58, 66, 78];
const POST_COLOR: [number, number, number] = [150, 148, 141];
const MATTE = { ambient: 0.5, diffuse: 0.62, shininess: 16, specularColor: [36, 36, 36] as [number, number, number] };

/**
 * Which way the rotor faces. The preview does not model wind direction, so
 * the choice is stated rather than implied: the rotor faces the viewer — the
 * default camera from above, or the person standing on the ring in an
 * eye-level view. Face-on is the largest the rotor can appear, so the preview
 * never understates it.
 */
const DEFAULT_CAMERA_BEARING_DEG = -28;
/** deck.gl yaw (counter-clockwise from east) for a rotor facing a viewer at `azimuthDeg` (clockwise from north). */
function yawTowards(azimuthDeg: number): number {
  return 90 - azimuthDeg;
}
/** Illustrative rotor speed for the optional animation — slow enough to read as calm, not as data. */
const ROTOR_DEG_PER_SECOND = 48;

const UNIT_SOURCE = "preview-unit";
const NEIGHBOUR_SOURCE = "preview-neighbours";
const RING_SOURCE = "preview-rings";

const INK_RGB: [number, number, number] = [31, 30, 27];

/** Keep the subject centred in the part of the canvas the panel leaves free. */
function panelPadding() {
  return window.matchMedia("(max-width: 760px)").matches
    ? { top: 0, right: 0, bottom: Math.round(window.innerHeight * 0.45), left: 0 }
    : { top: 0, right: 0, bottom: 0, left: 380 };
}

/** The rings in view: how far the rules reach. */
function overviewCamera(technology: SceneTechnology) {
  return technology === "wind"
    ? { zoom: 14.9, pitch: 60, bearing: DEFAULT_CAMERA_BEARING_DEG }
    : { zoom: 17.1, pitch: 58, bearing: -24 };
}

/** The installation in view: what stands there. The first camera a reader sees. */
function closeCamera(technology: SceneTechnology) {
  return technology === "wind"
    ? { zoom: 16.35, pitch: 74, bearing: DEFAULT_CAMERA_BEARING_DEG }
    : { zoom: 17.75, pitch: 66, bearing: -24 };
}

export function Scene({
  data,
  technology,
  spinning,
  view,
  onStatus,
}: {
  data: PreviewData | null;
  technology: SceneTechnology;
  spinning: boolean;
  view: ViewRequest | null;
  onStatus: (status: { terrain: "loading" | "ready" | "absent" }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Bumped whenever terrain tiles arrive, so models are re-seated on the ground.
  const [groundVersion, setGroundVersion] = useState(0);
  const [roll, setRoll] = useState(0);
  // Azimuth of the viewer as seen from the turbine; the default camera sits opposite its own bearing.
  const [viewerAzimuth, setViewerAzimuth] = useState(DEFAULT_CAMERA_BEARING_DEG + 180);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  // --- Map + overlay, once -------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !data) return;
    setWorkerUrl("/maplibre-gl-worker.mjs");
    const camera = closeCamera(technology);
    const map = new MaplibreMap({
      container: containerRef.current,
      style: "/api/tiles/style.json?terrain=1",
      center: data.unit.anchor as [number, number],
      ...camera,
      // Looking up at a hub from eye height needs a pitch past the horizontal (≈ 104° from 480 m).
      maxPitch: 115,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.setPadding(panelPadding());
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

    const lighting = new LightingEffect({
      ambient: new AmbientLight({ color: [255, 255, 255], intensity: 0.85 }),
      sun: new DirectionalLight({ color: [255, 250, 240], intensity: 1.25, direction: [-1.2, 2, -2.2] }),
    });
    exposeTransformForDeck(map);
    const overlay = new MapboxOverlay({ interleaved: true, effects: [lighting], layers: [] });
    overlayRef.current = overlay;
    map.addControl(overlay);

    map.on("load", () => {
      for (const tech of ["pv", "agripv", "wind"] as const) {
        for (const verdict of MAP_VERDICTS) {
          const appearance = verdictAppearance(verdict, tech);
          if (appearance.encoding) {
            addPattern(map, patternName(verdict, tech), appearance.encoding, appearance.color, PATTERN_MARK_COLOR, 0.75);
          }
        }
      }
      const empty = { type: "FeatureCollection" as const, features: [] };
      map.addSource(NEIGHBOUR_SOURCE, { type: "geojson", data: empty });
      map.addSource(UNIT_SOURCE, { type: "geojson", data: empty });
      map.addSource(RING_SOURCE, { type: "geojson", data: empty });

      map.addLayer({
        id: "neighbours-fill",
        type: "fill",
        source: NEIGHBOUR_SOURCE,
        filter: ["!=", ["get", "selected"], true],
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.28 },
      });
      map.addLayer({
        id: "neighbours-edge",
        type: "line",
        source: NEIGHBOUR_SOURCE,
        paint: { "line-color": INK, "line-width": 0.6, "line-opacity": 0.35 },
      });
      map.addLayer({
        id: "unit-fill",
        type: "fill",
        source: UNIT_SOURCE,
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "unit-pattern",
        type: "fill",
        source: UNIT_SOURCE,
        filter: ["has", "pattern"],
        paint: { "fill-pattern": ["get", "pattern"] as unknown as ExpressionSpecification, "fill-opacity": 0.6 },
      });
      map.addLayer({
        id: "unit-edge-halo",
        type: "line",
        source: UNIT_SOURCE,
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": 6 },
      });
      map.addLayer({
        id: "unit-edge",
        type: "line",
        source: UNIT_SOURCE,
        paint: { "line-color": INK, "line-width": 2.5 },
      });
      map.addLayer({
        id: "rings-halo",
        type: "line",
        source: RING_SOURCE,
        paint: { "line-color": PATTERN_MARK_COLOR, "line-width": 5, "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "rings",
        type: "line",
        source: RING_SOURCE,
        paint: {
          "line-color": INK,
          "line-width": 2,
          "line-dasharray": ["case", ["==", ["get", "dashed"], true], ["literal", [3, 2]], ["literal", [1, 0]]] as unknown as ExpressionSpecification,
        },
      });
      setLoaded(true);
    });

    // Terrain arrives tile by tile; re-seat the models each time more of it has loaded.
    let pending = false;
    map.on("sourcedata", (event) => {
      if (event.sourceId !== "terrain" || !event.isSourceLoaded || pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        setGroundVersion((v) => v + 1);
        onStatusRef.current({ terrain: "ready" });
      });
    });
    map.once("idle", () => {
      if (!map.getTerrain()) onStatusRef.current({ terrain: "absent" });
    });

    return () => {
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // The map is built once, when the first data arrives; later changes flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data !== null]);

  // --- Ground: unit, neighbours, rings (MapLibre, draped on terrain) --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !data) return;
    const tech = technology === "status_quo" ? null : technology;
    const appearance = tech ? verdictAppearance(unitVerdict(data), tech) : null;

    (map.getSource(NEIGHBOUR_SOURCE) as GeoJSONSource).setData(data.neighbours as never);
    (map.getSource(UNIT_SOURCE) as GeoJSONSource).setData({
      type: "Feature",
      properties: appearance?.encoding && tech ? { pattern: patternName(unitVerdict(data), tech) } : {},
      geometry: data.unit.geometry as unknown as GeoJSON.Polygon,
    });
    map.setPaintProperty("unit-fill", "fill-color", appearance ? appearance.color : "#ffffff");
    map.setPaintProperty("unit-fill", "fill-opacity", appearance ? 0.35 : 0.3);
    (map.getSource(RING_SOURCE) as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: technology === "wind"
        ? data.rings
            .filter((ring) => ring.geometry)
            .map((ring) => ({
              type: "Feature" as const,
              properties: { id: ring.id, dashed: ring.id === "baugb_249_10" },
              geometry: ring.geometry as unknown as GeoJSON.Polygon,
            }))
        : [],
    });
  }, [data, technology, loaded]);

  // --- Rotor animation ------------------------------------------------------
  useEffect(() => {
    if (!spinning || technology !== "wind") return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setRoll((r) => (r + ((now - last) / 1000) * ROTOR_DEG_PER_SECOND) % 360);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning, technology]);

  // --- Meshes, rebuilt only when dimensions change --------------------------
  const hub = data?.turbine.hubHeightM ?? 0;
  const rotor = data?.turbine.rotorDiameterM ?? 0;
  const meshes = useMemo(() => {
    const layout = technology === "agripv" ? AGRIPV_LAYOUT : PV_LAYOUT;
    return {
      body: turbineBodyMesh(hub, rotor),
      rotor: rotorMesh(rotor),
      table: moduleTableMesh(layout.tableDepth.value, layout.tilt.value, layout.lowerEdge.value),
      post: postMesh(
        moduleTableCentreHeightM(layout.tableDepth.value, layout.tilt.value, layout.lowerEdge.value),
        technology === "agripv" ? 0.25 : 0.12,
      ),
    };
  }, [hub, rotor, technology]);

  // --- deck.gl layers -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay || !loaded || !data) return;
    const ground = (p: readonly [number, number]) => map.queryTerrainElevation(p as [number, number]) ?? 0;
    const layers: Layer[] = [];

    if (technology === "wind") {
      const anchor = data.unit.anchor;
      const base = ground(anchor);
      const yawDeg = yawTowards(viewerAzimuth);
      const yaw = (yawDeg * Math.PI) / 180;
      const overhang = rotorOverhangM(rotor);
      const position: [number, number, number] = [anchor[0], anchor[1], base];
      layers.push(
        new SimpleMeshLayer({
          id: "turbine-body",
          data: [position],
          mesh: meshes.body as never,
          getPosition: (d: [number, number, number]) => d,
          getOrientation: [0, yawDeg, 0],
          getColor: TURBINE_COLOR,
          material: MATTE,
          updateTriggers: { getOrientation: yawDeg },
        }),
        new SimpleMeshLayer({
          id: "turbine-rotor",
          data: [position],
          mesh: meshes.rotor as never,
          getPosition: (d: [number, number, number]) => d,
          getTranslation: [Math.cos(yaw) * overhang, Math.sin(yaw) * overhang, hub],
          getOrientation: [0, yawDeg, roll],
          getColor: TURBINE_COLOR,
          material: MATTE,
          updateTriggers: { getOrientation: [roll, yawDeg], getTranslation: [hub, rotor, yawDeg] },
        }),
      );

      // In an eye-level view the viewer stands on a ring, and its label would sit at their feet;
      // the panel's caption names the viewpoint instead.
      const eyeLevel = view?.kind === "eye";
      const labels = data.rings
        .filter((ring) => ring.labelPoint && !eyeLevel)
        .map((ring) => {
          const rule = SETBACK_RINGS.find((r) => r.id === ring.id);
          const p = ring.labelPoint as [number, number];
          return {
            position: [p[0], p[1], ground(p) + 3] as [number, number, number],
            text: `${rule?.shortLabelDe ?? ""} ${formatMetres(ring.radiusM)} · ${rule?.citationDe ?? ""}`,
          };
        });
      labels.push({
        position: [anchor[0], anchor[1], base + totalHeightM(hub, rotor) + 14],
        text: `Gesamthöhe ${formatMetres(totalHeightM(hub, rotor))}`,
      });
      layers.push(labelLayer("labels", labels));
    }

    if (technology === "pv" || technology === "agripv") {
      const rows = data.rows.map((row) => ({ ...row, z: ground(row.position) }));
      const posts = data.rows.flatMap((row) => row.posts.map((p) => [p[0], p[1], ground(p)] as [number, number, number]));
      layers.push(
        new SimpleMeshLayer({
          id: "module-tables",
          data: rows,
          mesh: meshes.table as never,
          getPosition: (row: PreviewRow & { z: number }) => [row.position[0], row.position[1], row.z],
          getOrientation: (row: PreviewRow) => [0, 90 - row.azimuthDeg, 0],
          getScale: (row: PreviewRow) => [row.lengthM, 1, 1],
          getColor: TABLE_COLOR,
          material: { ...MATTE, shininess: 40, specularColor: [70, 76, 86] },
          updateTriggers: { getPosition: groundVersion },
        }),
        new SimpleMeshLayer({
          id: "module-posts",
          data: posts,
          mesh: meshes.post as never,
          getPosition: (d: [number, number, number]) => d,
          getColor: POST_COLOR,
          material: MATTE,
          updateTriggers: { getPosition: groundVersion },
        }),
      );
    }

    overlay.setProps({ layers });
  }, [data, technology, loaded, groundVersion, roll, meshes, hub, rotor, viewerAzimuth, view]);

  // --- Camera ---------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !data || !view) return;
    const anchor = data.unit.anchor as [number, number];
    if (view.kind === "overview" || view.kind === "close") {
      const camera = view.kind === "overview" ? overviewCamera(technology) : closeCamera(technology);
      map.setCenterClampedToGround(true);
      setViewerAzimuth(camera.bearing + 180);
      map.easeTo({ center: anchor, ...camera, padding: panelPadding(), duration: 1200 });
      return;
    }
    const ring = data.rings.find((r) => r.id === view.ringId);
    const viewpoint = ring?.viewpoints?.find((v) => v.bearingDeg === view.bearingDeg);
    if (!viewpoint) return;
    const from = new LngLat(viewpoint.position[0], viewpoint.position[1]);
    const to = new LngLat(anchor[0], anchor[1]);
    const ground = (p: LngLat) => map.queryTerrainElevation(p) ?? 0;
    const target = ground(to) + totalHeightM(hub, rotor) / 2;
    // calculateCameraOptionsFromTo places the camera for an unpadded viewport
    // whose centre floats at the target's height; left clamped to the ground,
    // MapLibre would pull that centre down at the end of the ease and the
    // viewer would end up somewhere the ring does not say.
    map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
    map.setCenterClampedToGround(false);
    setViewerAzimuth(view.bearingDeg);
    // A cut rather than an ease: MapLibre's easing clamps pitch to 90° on the
    // way, which would leave the viewer looking at the horizon instead of up
    // at the hub.
    map.jumpTo(map.calculateCameraOptionsFromTo(from, ground(from) + EYE_HEIGHT_M, to, target));
  }, [view, loaded, data, technology, hub, rotor]);

  return (
    <div className="map-canvas">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/**
 * deck.gl 9.4's MapLibre adapter still reads `map.transform.{elevation,
 * height,_nearZ,_farZ}` to seat its camera on terrain; MapLibre 6 no longer
 * exposes `map.transform`. Without this every frame throws and no model is
 * drawn. The shim answers exactly those four reads — from public API where
 * MapLibre has one — and steps aside if a future MapLibre or deck.gl makes it
 * unnecessary. Remove once deck.gl supports MapLibre 6 natively.
 */
function exposeTransformForDeck(map: MaplibreMap): void {
  if ("transform" in map && (map as unknown as { transform?: unknown }).transform) return;
  Object.defineProperty(map, "transform", {
    configurable: true,
    get() {
      const internal = (map as unknown as { _transformProvider?: { transform?: { nearZ?: number; farZ?: number } } })
        ._transformProvider?.transform;
      return {
        elevation: map.getCenterElevation(),
        height: map.getCanvas().clientHeight,
        _nearZ: internal?.nearZ,
        _farZ: internal?.farZ,
      };
    },
  });
}

function unitVerdict(data: PreviewData) {
  const own = data.neighbours.features.find((f) => f.id === data.unit.id);
  return (own?.properties.verdict as "suitable" | "unsuitable" | "excluded" | "unscored" | undefined) ?? "unscored";
}

const METRES = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
export function formatMetres(value: number): string {
  return `${METRES.format(value)} m`;
}

function labelLayer(id: string, data: { position: [number, number, number]; text: string }[]) {
  return new TextLayer({
    id,
    data,
    getPosition: (d) => d.position,
    getText: (d) => d.text,
    getColor: INK_RGB,
    getSize: 13,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeight: 600,
    characterSet: "auto",
    background: true,
    getBackgroundColor: [255, 255, 255, 235],
    backgroundPadding: [6, 3],
    getBorderColor: [31, 30, 27, 60],
    getBorderWidth: 1,
    billboard: true,
    // Labels stay readable when a hill or the tower stands in front of them.
    parameters: { depthCompare: "always" },
  });
}
