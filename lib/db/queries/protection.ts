// Reads of `protection_overlap` (lib/db/migrations/0006_pv_rules_step1.sql,
// ADR-0009): the protected areas a unit overlaps, written by
// ingest/real/22_protection_overlap.sql. Which of them become a Prüfhinweis is
// decided by lib/scoring/protection-flags.ts, never here.

import type { ProtectionCategory, ProtectionOverlap } from "@/lib/scoring/protection-flags";
import { query } from "../client";

interface ProtectionOverlapSqlRow {
  spatial_unit_id: string;
  category: ProtectionCategory;
  area_code: string;
  name: string;
  share: number;
  source_id: string;
}

/** Every overlap of a region's units, for materialisation (ingest/07_materialize_scores.ts). */
export async function listProtectionOverlapsForPilotRegion(pilotRegion: string): Promise<ProtectionOverlap[]> {
  const rows = await query<ProtectionOverlapSqlRow>(
    `SELECT po.spatial_unit_id, po.category, po.area_code, po.name, po.share, po.source_id
     FROM protection_overlap po JOIN spatial_unit su ON su.id = po.spatial_unit_id
     WHERE su.pilot_region = $1`,
    [pilotRegion],
  );
  return rows.map(toOverlap);
}

export async function listProtectionOverlapsForUnit(spatialUnitId: string): Promise<ProtectionOverlap[]> {
  const rows = await query<ProtectionOverlapSqlRow>(
    `SELECT spatial_unit_id, category, area_code, name, share, source_id
     FROM protection_overlap
     WHERE spatial_unit_id = $1
     ORDER BY category, share DESC, name`,
    [spatialUnitId],
  );
  return rows.map(toOverlap);
}

function toOverlap(row: ProtectionOverlapSqlRow): ProtectionOverlap {
  return {
    spatialUnitId: row.spatial_unit_id,
    category: row.category,
    areaCode: row.area_code,
    name: row.name,
    share: Number(row.share),
    sourceId: row.source_id,
  };
}
