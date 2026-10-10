// The explorer's state in the URL (roadmap-planning-tool.md Phase 3): what is
// shown — region, technology, map position, the selected cell, the cells
// chosen together — so a view can be bookmarked, pasted into an e-mail or
// cited in a council paper and opens the same way for the next reader.
// Pure: parsing and serialising only; Explorer.tsx reads and writes
// window.location.
//
//   region  the region id (resolved by the server page)
//   t       technology: pv | agripv | wind
//   v       map view as z/lat/lng, e.g. 12.4/53.2851/13.8622
//   u       the selected cell's id
//   g       cells chosen together, comma-separated ids

import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";
import { MAX_GROUP_CELLS, parseIds } from "@/lib/search/group";

export interface MapView {
  readonly zoom: number;
  readonly lat: number;
  readonly lng: number;
}

export interface ExplorerUrlState {
  readonly technology: Technology | null;
  readonly view: MapView | null;
  readonly selectedId: string | null;
  readonly group: readonly string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseView(text: string | null): MapView | null {
  if (!text) return null;
  const parts = text.split("/");
  if (parts.length !== 3) return null;
  const [zoom, lat, lng] = parts.map(Number) as [number, number, number];
  if (![zoom, lat, lng].every(Number.isFinite)) return null;
  if (zoom < 0 || zoom > 24 || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { zoom, lat, lng };
}

export function formatView(view: MapView): string {
  return `${view.zoom.toFixed(2)}/${view.lat.toFixed(5)}/${view.lng.toFixed(5)}`;
}

export function parseExplorerUrl(params: URLSearchParams): ExplorerUrlState {
  const t = params.get("t");
  const u = params.get("u");
  return {
    technology: t && (TECHNOLOGIES as readonly string[]).includes(t) ? (t as Technology) : null,
    view: parseView(params.get("v")),
    selectedId: u && UUID.test(u) ? u.toLowerCase() : null,
    group: parseIds(params.get("g") ?? undefined, MAX_GROUP_CELLS) ?? [],
  };
}

/** The query string for a state; `region` is always first so a pasted link reads as "this region, this view". */
export function serializeExplorerUrl(region: string, state: ExplorerUrlState): string {
  const params = new URLSearchParams();
  params.set("region", region);
  if (state.technology && state.technology !== "pv") params.set("t", state.technology);
  if (state.view) params.set("v", formatView(state.view));
  if (state.selectedId) params.set("u", state.selectedId);
  if (state.group.length > 0) params.set("g", state.group.join(","));
  return `?${params.toString()}`;
}
