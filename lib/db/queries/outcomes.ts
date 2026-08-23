// Reads of `outcome` (lib/db/migrations/0002_domain_schema.sql), plus deltas
// against the status_quo baseline computed at read time via the existing
// pure lib/scoring/outcomes.ts#computeOutcomeDelta — deltas are never
// stored (see that function's own doc comment).

import { computeOutcomeDelta } from "@/lib/scoring/outcomes";
import type { OutcomeDelta, OutcomeDimension, OutcomeRow, Scenario } from "@/lib/scoring/types";
import { getPool, query } from "../client";

interface OutcomeSqlRow {
  spatial_unit_id: string;
  scenario: Scenario;
  dimension: OutcomeDimension;
  value: string | null;
  unit: string | null;
  confidence: OutcomeRow["confidence"];
  status: OutcomeRow["status"];
  method_version: string;
}

function toOutcomeRow(row: OutcomeSqlRow): OutcomeRow {
  return {
    spatialUnitId: row.spatial_unit_id,
    scenario: row.scenario,
    dimension: row.dimension,
    value: row.value === null ? null : Number(row.value),
    unit: row.unit,
    confidence: row.confidence,
    status: row.status,
    methodVersion: row.method_version,
  };
}

export interface OutcomeComparisonRow {
  readonly dimension: OutcomeDimension;
  readonly scenario: Scenario;
  readonly outcome: OutcomeRow;
  /** null when either this row or the status_quo baseline is not_modelled. */
  readonly delta: OutcomeDelta | null;
}

/**
 * Every scenario × dimension outcome for one unit, each paired with its
 * delta against status_quo — the data the scenario comparison screen
 * (roadmap §5.1, the centerpiece) renders directly.
 */
export async function listOutcomesForUnit(
  spatialUnitId: string,
  methodVersion: string,
): Promise<OutcomeComparisonRow[]> {
  const rows = await query<OutcomeSqlRow>(
    `SELECT spatial_unit_id, scenario, dimension, value, unit, confidence, status, method_version
     FROM outcome
     WHERE spatial_unit_id = $1 AND method_version = $2`,
    [spatialUnitId, methodVersion],
  );
  const outcomes = rows.map(toOutcomeRow);
  const baselineByDimension = new Map(
    outcomes.filter((o) => o.scenario === "status_quo").map((o) => [o.dimension, o]),
  );

  return outcomes.map((outcome) => {
    const baseline = baselineByDimension.get(outcome.dimension);
    const delta =
      outcome.scenario === "status_quo" || !baseline ? null : computeOutcomeDelta(outcome, baseline);
    return { dimension: outcome.dimension, scenario: outcome.scenario, outcome, delta };
  });
}

/**
 * Upserts one outcome row on the (spatial_unit_id, scenario, dimension,
 * method_version) unique constraint. Used by
 * ingest/07_materialize_scores.ts — this module never aggregates an
 * outcome itself, only persists one `computeOutcomeRow` already produced.
 */
export async function upsertOutcomeRow(row: OutcomeRow): Promise<void> {
  await getPool().query(
    `INSERT INTO outcome (spatial_unit_id, scenario, dimension, value, unit, confidence, status, method_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (spatial_unit_id, scenario, dimension, method_version) DO UPDATE
       SET value = EXCLUDED.value,
           unit = EXCLUDED.unit,
           confidence = EXCLUDED.confidence,
           status = EXCLUDED.status,
           computed_at = now()`,
    [row.spatialUnitId, row.scenario, row.dimension, row.value, row.unit, row.confidence, row.status, row.methodVersion],
  );
}
