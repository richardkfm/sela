// Limits and parsing for a group of cells (roadmap Step 5): chosen on the map,
// carried in the URL (`?ids=a,b,c`), so a summary or a side-by-side comparison
// can be linked, printed and reopened.

/** Cells a site summary accepts: enough for a field block (~2.6 ha per cell), short enough for a URL. */
export const MAX_GROUP_CELLS = 100;

/** Cells side by side (mvp.md F6): beyond six columns a comparison stops being readable on a screen or on A4. */
export const MAX_SIDE_BY_SIDE = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Distinct, well-formed unit ids from an `ids` parameter, in the order given, at most `max`; null if any id is malformed. */
export function parseIds(raw: string | string[] | undefined, max: number): string[] | null {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const ids = [...new Set(text.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (ids.length === 0 || ids.length > max || !ids.every((id) => UUID.test(id))) return null;
  return ids;
}

/** Adds or removes `id`; adding beyond `max` is refused (returns the group unchanged). */
export function toggleInGroup(group: readonly string[], id: string, max: number = MAX_GROUP_CELLS): string[] {
  if (group.includes(id)) return group.filter((g) => g !== id);
  if (group.length >= max) return [...group];
  return [...group, id];
}
