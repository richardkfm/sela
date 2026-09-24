// Reads of `outcome` (lib/db/migrations/0002_domain_schema.sql), plus deltas
// against the status_quo baseline computed at read time via the existing
// pure lib/scoring/outcomes.ts#computeOutcomeDelta — deltas are never
// stored (see that function's own doc comment).

import { computeOutcomeDelta } from "@/lib/scoring/outcomes";
import type { OutcomeMethod } from "@/lib/scoring/nature/method";
import type { OutcomeDelta, OutcomeDimension, OutcomeRow, Scenario } from "@/lib/scoring/types";
import { getPool, query } from "../client";

interface OutcomeSqlRow {
  spatial_unit_id: string;
  scenario: Scenario;
  dimension: OutcomeDimension;
  metric: string;
  value: string | null;
  value_low: string | null;
  value_high: string | null;
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
    metric: row.metric,
    value: row.value === null ? null : Number(row.value),
    valueLow: row.value_low === null ? null : Number(row.value_low),
    valueHigh: row.value_high === null ? null : Number(row.value_high),
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
    `SELECT spatial_unit_id, scenario, dimension, metric, value, value_low, value_high, unit, confidence, status,
            method_version
     FROM outcome
     WHERE spatial_unit_id = $1 AND method_version = $2`,
    [spatialUnitId, methodVersion],
  );
  const outcomes = rows.map(toOutcomeRow);
  const baselineByMetric = new Map(
    outcomes.filter((o) => o.scenario === "status_quo").map((o) => [`${o.dimension}/${o.metric}`, o]),
  );

  return outcomes.map((outcome) => {
    const baseline = baselineByMetric.get(`${outcome.dimension}/${outcome.metric}`);
    const delta =
      outcome.scenario === "status_quo" || !baseline ? null : computeOutcomeDelta(outcome, baseline);
    return { dimension: outcome.dimension, scenario: outcome.scenario, outcome, delta };
  });
}

/**
 * Upserts one outcome row on the (spatial_unit_id, scenario, dimension,
 * metric, method_version) unique constraint. Used by
 * ingest/07_materialize_scores.ts — this module never aggregates an
 * outcome itself, only persists one `computeOutcomeRow` already produced.
 */
export async function upsertOutcomeRow(row: OutcomeRow): Promise<void> {
  await getPool().query(
    `INSERT INTO outcome
       (spatial_unit_id, scenario, dimension, metric, value, value_low, value_high, unit, confidence, status, method_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (spatial_unit_id, scenario, dimension, metric, method_version) DO UPDATE
       SET value = EXCLUDED.value,
           value_low = EXCLUDED.value_low,
           value_high = EXCLUDED.value_high,
           unit = EXCLUDED.unit,
           confidence = EXCLUDED.confidence,
           status = EXCLUDED.status,
           computed_at = now()`,
    [
      row.spatialUnitId,
      row.scenario,
      row.dimension,
      row.metric,
      row.value,
      row.valueLow,
      row.valueHigh,
      row.unit,
      row.confidence,
      row.status,
      row.methodVersion,
    ],
  );
}

/** Writes or refreshes one `outcome_method` row (ADR-0008 §4) from its definition in lib/scoring/nature/. */
export async function upsertOutcomeMethod(method: OutcomeMethod): Promise<void> {
  await getPool().query(
    `INSERT INTO outcome_method (method_version, dimension, name_de, name_en, citation, parameters, description_de)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (method_version) DO UPDATE
       SET dimension = EXCLUDED.dimension, name_de = EXCLUDED.name_de, name_en = EXCLUDED.name_en,
           citation = EXCLUDED.citation, parameters = EXCLUDED.parameters,
           description_de = EXCLUDED.description_de, updated_at = now()`,
    [
      method.methodVersion,
      method.dimension,
      method.nameDe,
      method.nameEn,
      method.citation,
      JSON.stringify(method.parameters),
      method.descriptionDe,
    ],
  );
}

/** One outcome row and the criterion values it was computed from. */
export interface OutcomeWithInputs {
  readonly row: OutcomeRow;
  readonly criterionValueIds: readonly number[];
}

/**
 * Replaces every outcome of one method in one pilot region, with its
 * `outcome_input` rows, in one transaction (ADR-0008 §4). Streams the rows in
 * batches: a real region is ~117 000 cells × 6 scenarios × each metric, too
 * many to hold at once.
 *
 * Refuses a `modelled` row without inputs — the rule ADR-0008 states is
 * enforced here rather than by a trigger.
 */
export async function replaceOutcomesForPilotRegion(
  pilotRegion: string,
  methodVersion: string,
  outcomes: Iterable<OutcomeWithInputs>,
  batchSize = 5000,
): Promise<number> {
  const client = await getPool().connect();
  let written = 0;

  const flush = async (batch: readonly OutcomeWithInputs[]) => {
    const rows = batch.map((o) => o.row);
    await client.query(
      `INSERT INTO outcome
         (spatial_unit_id, scenario, dimension, metric, value, value_low, value_high, unit, confidence, status,
          method_version)
       SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[],
                            $7::float8[], $8::text[], $9::text[], $10::text[], $11::text[])`,
      [
        rows.map((r) => r.spatialUnitId),
        rows.map((r) => r.scenario),
        rows.map((r) => r.dimension),
        rows.map((r) => r.metric),
        rows.map((r) => r.value),
        rows.map((r) => r.valueLow),
        rows.map((r) => r.valueHigh),
        rows.map((r) => r.unit),
        rows.map((r) => r.confidence),
        rows.map((r) => r.status),
        rows.map((r) => r.methodVersion),
      ],
    );

    const links = batch.flatMap(({ row, criterionValueIds }) => criterionValueIds.map((id) => ({ row, id })));
    if (links.length > 0) {
      await client.query(
        `INSERT INTO outcome_input (outcome_id, criterion_value_id)
         SELECT o.id, i.criterion_value_id
         FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::bigint[])
              AS i(spatial_unit_id, scenario, dimension, metric, criterion_value_id)
         JOIN outcome o
           ON o.spatial_unit_id = i.spatial_unit_id AND o.scenario = i.scenario AND o.dimension = i.dimension
          AND o.metric = i.metric AND o.method_version = $6
         ON CONFLICT DO NOTHING`,
        [
          links.map((l) => l.row.spatialUnitId),
          links.map((l) => l.row.scenario),
          links.map((l) => l.row.dimension),
          links.map((l) => l.row.metric),
          links.map((l) => l.id),
          methodVersion,
        ],
      );
    }
    written += batch.length;
  };

  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM outcome o USING spatial_unit su
       WHERE su.id = o.spatial_unit_id AND su.pilot_region = $1 AND o.method_version = $2`,
      [pilotRegion, methodVersion],
    );
    let batch: OutcomeWithInputs[] = [];
    for (const outcome of outcomes) {
      const { row, criterionValueIds } = outcome;
      if (row.methodVersion !== methodVersion) {
        throw new Error(`outcome for ${row.spatialUnitId} has method ${row.methodVersion}, expected ${methodVersion}`);
      }
      if (row.status === "modelled" && criterionValueIds.length === 0) {
        throw new Error(
          `modelled outcome ${row.dimension}/${row.metric} for ${row.spatialUnitId} has no criterion inputs (ADR-0008)`,
        );
      }
      batch.push(outcome);
      if (batch.length >= batchSize) {
        await flush(batch);
        batch = [];
      }
    }
    if (batch.length > 0) await flush(batch);
    await client.query("COMMIT");
    return written;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
