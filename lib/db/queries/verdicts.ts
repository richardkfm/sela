// Reads of `suitability_verdict` (lib/db/migrations/0002_domain_schema.sql).
// Rows are written once, at materialization time (ingest/07_materialize_scores.ts),
// by the pure lib/scoring/suitability.ts functions — this module only reads
// them back; it never computes a verdict itself.

import type { SuitabilityVerdict, Technology } from "@/lib/scoring/types";
import { getPool, query } from "../client";

interface SuitabilityVerdictSqlRow {
  spatial_unit_id: string;
  technology: Technology;
  verdict: SuitabilityVerdict["verdict"];
  score: string | null;
  limiting_criterion_id: string | null;
  excluded_by_criterion_id: string | null;
  method_version: string;
}

function toVerdict(row: SuitabilityVerdictSqlRow): SuitabilityVerdict {
  return {
    spatialUnitId: row.spatial_unit_id,
    technology: row.technology,
    verdict: row.verdict,
    score: row.score === null ? null : Number(row.score),
    limitingCriterionId: row.limiting_criterion_id,
    excludedByCriterionId: row.excluded_by_criterion_id,
    methodVersion: row.method_version,
  };
}

const VERDICT_COLUMNS = `
  spatial_unit_id, technology, verdict, score, limiting_criterion_id, excluded_by_criterion_id, method_version
`;

/** All three technologies' current verdicts for one spatial unit (parcel detail, flow F2). */
export async function listVerdictsForUnit(
  spatialUnitId: string,
  methodVersion: string,
): Promise<SuitabilityVerdict[]> {
  const rows = await query<SuitabilityVerdictSqlRow>(
    `SELECT ${VERDICT_COLUMNS} FROM suitability_verdict
     WHERE spatial_unit_id = $1 AND method_version = $2
     ORDER BY technology`,
    [spatialUnitId, methodVersion],
  );
  return rows.map(toVerdict);
}

/** Every unit's verdict for one technology in a pilot region, for map fill coloring. */
export async function listVerdictsForPilotRegion(
  pilotRegion: string,
  technology: Technology,
  methodVersion: string,
): Promise<SuitabilityVerdict[]> {
  const rows = await query<SuitabilityVerdictSqlRow>(
    `SELECT sv.spatial_unit_id, sv.technology, sv.verdict, sv.score,
            sv.limiting_criterion_id, sv.excluded_by_criterion_id, sv.method_version
     FROM suitability_verdict sv
     JOIN spatial_unit su ON su.id = sv.spatial_unit_id
     WHERE su.pilot_region = $1 AND sv.technology = $2 AND sv.method_version = $3`,
    [pilotRegion, technology, methodVersion],
  );
  return rows.map(toVerdict);
}

/**
 * Upserts one verdict on the (spatial_unit_id, technology, method_version)
 * unique constraint (lib/db/migrations/0002_domain_schema.sql). Used by
 * ingest/07_materialize_scores.ts — this module never computes a verdict
 * itself, only persists one `computeSuitability` already produced.
 */
export async function upsertVerdict(verdict: SuitabilityVerdict): Promise<void> {
  await getPool().query(
    `INSERT INTO suitability_verdict
       (spatial_unit_id, technology, verdict, score, limiting_criterion_id, excluded_by_criterion_id, method_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (spatial_unit_id, technology, method_version) DO UPDATE
       SET verdict = EXCLUDED.verdict,
           score = EXCLUDED.score,
           limiting_criterion_id = EXCLUDED.limiting_criterion_id,
           excluded_by_criterion_id = EXCLUDED.excluded_by_criterion_id,
           computed_at = now()`,
    [
      verdict.spatialUnitId,
      verdict.technology,
      verdict.verdict,
      verdict.score,
      verdict.limitingCriterionId,
      verdict.excludedByCriterionId,
      verdict.methodVersion,
    ],
  );
}
