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

export async function listProtectionOverlapsForUnit(spatialUnitId: string): Promise<ProtectionOverlap[]> {
  const rows = await query<ProtectionOverlapSqlRow>(
    `SELECT spatial_unit_id, category, area_code, name, share, source_id
     FROM protection_overlap
     WHERE spatial_unit_id = $1
     ORDER BY category, share DESC, name`,
    [spatialUnitId],
  );
  return rows.map((row) => ({
    spatialUnitId: row.spatial_unit_id,
    category: row.category,
    areaCode: row.area_code,
    name: row.name,
    share: Number(row.share),
    sourceId: row.source_id,
  }));
}
