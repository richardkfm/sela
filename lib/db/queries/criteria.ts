// Reads of `source` and `criterion_definition`
// (lib/db/migrations/0002_domain_schema.sql). Returns rows shaped as a
// superset of lib/scoring/types.ts's CriterionDefinition — the scoring
// engine only reads the fields it declares, so a row from here can be
// passed straight into computeSuitability/computeOutcomeRow, and the
// evidence view (flow F4) can additionally read the display-only fields
// (nameEn, nameDe, unit, source) this module adds.

import type { CriterionDefinition, CriterionValue } from "@/lib/scoring/types";
import { query } from "../client";

export interface CriterionDefinitionRow extends CriterionDefinition {
  readonly nameEn: string;
  readonly nameDe: string;
  readonly unit: string | null;
}

export interface SourceRow {
  readonly id: string;
  readonly dataset: string;
  readonly publisher: string;
  readonly version: string | null;
  readonly retrievedAt: string | null;
  readonly licence: string;
  readonly redistributable: boolean;
  readonly url: string | null;
  /** The publisher's exact Quellenvermerk, `<Jahr>` still a placeholder. */
  readonly attribution: string;
  /** Where the licence requires the notice hyperlinked; null means it does not. */
  readonly attributionUrl: string | null;
  /** Whether a Veränderungshinweis must accompany the notice. */
  readonly changeNoticeRequired: boolean;
}

interface CriterionDefinitionSqlRow {
  id: string;
  name_en: string;
  name_de: string;
  source_id: string;
  direction: CriterionDefinition["direction"];
  weight: string;
  is_hard_constraint: boolean;
  applies_to: string[];
  unit: string | null;
  method_version: string;
}

function toCriterionDefinition(row: CriterionDefinitionSqlRow): CriterionDefinitionRow {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameDe: row.name_de,
    sourceId: row.source_id,
    direction: row.direction,
    weight: Number(row.weight),
    isHardConstraint: row.is_hard_constraint,
    appliesTo: row.applies_to,
    unit: row.unit,
    methodVersion: row.method_version,
  };
}

const CRITERION_DEFINITION_COLUMNS = `
  id, name_en, name_de, source_id, direction, weight, is_hard_constraint, applies_to, unit, method_version
`;

export async function listCriterionDefinitions(): Promise<CriterionDefinitionRow[]> {
  const rows = await query<CriterionDefinitionSqlRow>(
    `SELECT ${CRITERION_DEFINITION_COLUMNS} FROM criterion_definition ORDER BY id`,
  );
  return rows.map(toCriterionDefinition);
}

export async function getCriterionDefinition(id: string): Promise<CriterionDefinitionRow | null> {
  const rows = await query<CriterionDefinitionSqlRow>(
    `SELECT ${CRITERION_DEFINITION_COLUMNS} FROM criterion_definition WHERE id = $1`,
    [id],
  );
  return rows[0] ? toCriterionDefinition(rows[0]) : null;
}

interface CriterionValueSqlRow {
  id: string;
  criterion_id: string;
  spatial_unit_id: string;
  value: string;
  unit: string | null;
  confidence: CriterionValue["confidence"];
  source_id: string;
  method_version: string;
}

function toCriterionValue(row: CriterionValueSqlRow): CriterionValue {
  return {
    id: Number(row.id),
    criterionId: row.criterion_id,
    spatialUnitId: row.spatial_unit_id,
    value: Number(row.value),
    unit: row.unit,
    confidence: row.confidence,
    sourceId: row.source_id,
    methodVersion: row.method_version,
  };
}

export async function listCriterionValuesForUnit(spatialUnitId: string): Promise<CriterionValue[]> {
  const rows = await query<CriterionValueSqlRow>(
    `SELECT id, criterion_id, spatial_unit_id, value, unit, confidence, source_id, method_version
     FROM criterion_value
     WHERE spatial_unit_id = $1`,
    [spatialUnitId],
  );
  return rows.map(toCriterionValue);
}

/** All criterion_value rows for a pilot region's units, for batch materialization. */
/**
 * Every criterion value of one pilot region, or only those of the given
 * criteria — a real region has ~117 000 cells, so callers read what they use.
 */
export async function listCriterionValuesForPilotRegion(
  pilotRegion: string,
  criterionIds?: readonly string[],
): Promise<CriterionValue[]> {
  const rows = await query<CriterionValueSqlRow>(
    `SELECT cv.id, cv.criterion_id, cv.spatial_unit_id, cv.value, cv.unit, cv.confidence, cv.source_id, cv.method_version
     FROM criterion_value cv
     JOIN spatial_unit su ON su.id = cv.spatial_unit_id
     WHERE su.pilot_region = $1 AND ($2::text[] IS NULL OR cv.criterion_id = ANY ($2::text[]))`,
    [pilotRegion, criterionIds ?? null],
  );
  return rows.map(toCriterionValue);
}

interface SourceSqlRow {
  id: string;
  dataset: string;
  publisher: string;
  version: string | null;
  retrieved_at: string | null;
  licence: string;
  redistributable: boolean;
  url: string | null;
  attribution: string;
  attribution_url: string | null;
  change_notice_required: boolean;
}

function toSource(row: SourceSqlRow): SourceRow {
  return {
    id: row.id,
    dataset: row.dataset,
    publisher: row.publisher,
    version: row.version,
    retrievedAt: row.retrieved_at,
    licence: row.licence,
    redistributable: row.redistributable,
    url: row.url,
    attribution: row.attribution,
    attributionUrl: row.attribution_url,
    changeNoticeRequired: row.change_notice_required,
  };
}

// retrieved_at::text avoids pg parsing DATE into a JS Date object here —
// this module's SourceRow type is display-only and wants a plain string.
const SOURCE_COLUMNS =
  "id, dataset, publisher, version, retrieved_at::text AS retrieved_at, licence, redistributable, url, " +
  "attribution, attribution_url, change_notice_required";

export async function listSources(): Promise<SourceRow[]> {
  const rows = await query<SourceSqlRow>(`SELECT ${SOURCE_COLUMNS} FROM source ORDER BY id`);
  return rows.map(toSource);
}

export async function getSource(id: string): Promise<SourceRow | null> {
  const rows = await query<SourceSqlRow>(`SELECT ${SOURCE_COLUMNS} FROM source WHERE id = $1`, [id]);
  return rows[0] ? toSource(rows[0]) : null;
}
