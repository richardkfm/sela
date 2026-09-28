// Reads of `habitat_overlap` (lib/db/migrations/0009_habitat_overlap.sql;
// roadmap Step 4). Which rows a screen shows is lib/scoring/habitat.ts's rule.

import type { HabitatOverlap } from "@/lib/scoring/habitat";
import { query } from "../client";

interface HabitatOverlapSqlRow {
  spatial_unit_id: string;
  biotope_id: string;
  geometry_kind: HabitatOverlap["geometryKind"];
  biotope_code: string;
  biotope_name: string;
  protection_code: string | null;
  protection_text: string | null;
  lrt_code: string | null;
  lrt_name: string | null;
  lrt_grade: string | null;
  mapping_method: string | null;
  mapped_first: string | null;
  mapped_last: string | null;
  share: number | null;
  length_m: number | null;
  source_id: string;
}

function toOverlap(r: HabitatOverlapSqlRow): HabitatOverlap {
  return {
    spatialUnitId: r.spatial_unit_id,
    biotopeId: r.biotope_id,
    geometryKind: r.geometry_kind,
    biotopeCode: r.biotope_code,
    biotopeName: r.biotope_name,
    protectionCode: r.protection_code,
    protectionText: r.protection_text,
    lrtCode: r.lrt_code,
    lrtName: r.lrt_name,
    lrtGrade: r.lrt_grade,
    mappingMethod: r.mapping_method,
    mappedFirst: r.mapped_first,
    mappedLast: r.mapped_last,
    share: r.share === null ? null : Number(r.share),
    lengthM: r.length_m === null ? null : Number(r.length_m),
    sourceId: r.source_id,
  };
}

export async function listHabitatOverlapsForUnits(ids: readonly string[]): Promise<HabitatOverlap[]> {
  if (ids.length === 0) return [];
  const rows = await query<HabitatOverlapSqlRow>(
    `SELECT spatial_unit_id, biotope_id, geometry_kind, biotope_code, biotope_name, protection_code, protection_text,
            lrt_code, lrt_name, lrt_grade, mapping_method, to_char(mapped_first, 'YYYY-MM-DD') AS mapped_first,
            to_char(mapped_last, 'YYYY-MM-DD') AS mapped_last, share, length_m, source_id
     FROM habitat_overlap WHERE spatial_unit_id = ANY($1::uuid[])`,
    [ids],
  );
  return rows.map(toOverlap);
}

/** Whether a region has habitat data at all — without it every screen says "noch nicht erfasst", not "kein Biotop". */
export async function regionHasHabitatData(pilotRegion: string): Promise<boolean> {
  const rows = await query<{ has: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM habitat_overlap ho JOIN spatial_unit su ON su.id = ho.spatial_unit_id WHERE su.pilot_region = $1
     ) AS has`,
    [pilotRegion],
  );
  return rows[0]?.has ?? false;
}
