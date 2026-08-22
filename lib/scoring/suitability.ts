// Per-technology suitability (flow F2) and the ADR-0004 filter path.
// Pure arithmetic over already-computed criterion values — see
// docs/architecture/adr-0002-geodata-stack.md and
// docs/architecture/adr-0004-constraints-as-filters.md.

import type {
  CriterionDefinition,
  CriterionValue,
  SuitabilityVerdict,
  Technology,
} from "./types";
import { SelaScoringError } from "./types";

/**
 * A criterion's contribution once its raw value has been placed on a
 * comparable 0..1 scale, direction-adjusted so 1 always means "most
 * favourable". Producing this from a raw `CriterionValue` requires a
 * real-world scale or threshold (e.g. "what irradiation counts as
 * excellent") — that is scoring-method work gated by `CLAUDE.md` §3
 * (docs/domain/scoring-criteria.md), not something this module invents.
 * Callers supply it via `normalize`.
 *
 * For a hard-constraint criterion, `normalizedScore` is ignored and only
 * `violatesConstraint` matters — see ADR-0004.
 */
export interface NormalizedCriterion {
  readonly normalizedScore: number;
  readonly violatesConstraint: boolean;
}

export type Normalize = (
  value: CriterionValue,
  definition: CriterionDefinition,
) => NormalizedCriterion;

function applicableDefinitions(
  definitions: readonly CriterionDefinition[],
  technology: Technology,
): CriterionDefinition[] {
  return definitions.filter((d) => d.appliesTo.includes(technology));
}

/**
 * Deterministic tie-break: highest weight wins; if weights tie, lowest
 * criterion id (lexicographic) wins. Both inputs are guaranteed non-empty
 * by the caller.
 */
function pickByWeightThenId<T extends { weight: number; id: string }>(items: T[]): T {
  return [...items].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))[0]!;
}

export interface ComputeSuitabilityParams {
  readonly spatialUnitId: string;
  readonly technology: Technology;
  readonly values: readonly CriterionValue[];
  readonly definitions: readonly CriterionDefinition[];
  readonly normalize: Normalize;
  /**
   * The minimum weighted score (0..1) for a `suitable` verdict, below which
   * the verdict is `unsuitable`. A threshold, so it is gated the same way
   * weights are — callers must pass the confirmed real value; this module
   * has no default.
   */
  readonly suitabilityThreshold: number;
  readonly methodVersion: string;
}

/**
 * Computes one technology's suitability verdict for one spatial unit.
 *
 * A criterion with no `CriterionValue` present for this spatial unit takes
 * no part in either the exclusion check or the score — absence is not
 * evidence of anything, so it is never treated as satisfying or violating a
 * constraint, and never silently contributes a favourable or unfavourable
 * score.
 */
export function computeSuitability(params: ComputeSuitabilityParams): SuitabilityVerdict {
  const { spatialUnitId, technology, values, definitions, normalize, suitabilityThreshold, methodVersion } = params;

  if (suitabilityThreshold < 0 || suitabilityThreshold > 1) {
    throw new SelaScoringError(
      `suitabilityThreshold must be within [0, 1], got ${suitabilityThreshold}`,
    );
  }

  const valueByCriterionId = new Map(values.map((v) => [v.criterionId, v]));
  const applicable = applicableDefinitions(definitions, technology);

  const hardConstraints = applicable.filter((d) => d.isHardConstraint);
  const violated: { definition: CriterionDefinition; weight: number; id: string }[] = [];
  for (const definition of hardConstraints) {
    const value = valueByCriterionId.get(definition.id);
    if (!value) continue;
    const { violatesConstraint } = normalize(value, definition);
    if (violatesConstraint) {
      violated.push({ definition, weight: definition.weight, id: definition.id });
    }
  }

  if (violated.length > 0) {
    const excludedBy = pickByWeightThenId(violated).definition;
    return {
      spatialUnitId,
      technology,
      verdict: "excluded",
      score: null,
      limitingCriterionId: null,
      excludedByCriterionId: excludedBy.id,
      methodVersion,
    };
  }

  const scored = applicable.filter((d) => !d.isHardConstraint);
  const contributions: { definition: CriterionDefinition; normalizedScore: number }[] = [];
  for (const definition of scored) {
    const value = valueByCriterionId.get(definition.id);
    if (!value) continue;
    const { normalizedScore } = normalize(value, definition);
    if (normalizedScore < 0 || normalizedScore > 1) {
      throw new SelaScoringError(
        `normalize() returned normalizedScore ${normalizedScore} for criterion "${definition.id}"; must be within [0, 1]`,
      );
    }
    contributions.push({ definition, normalizedScore });
  }

  if (contributions.length === 0) {
    throw new SelaScoringError(
      `No scoreable criterion values available for spatial unit "${spatialUnitId}", technology "${technology}" — cannot compute a suitability verdict.`,
    );
  }

  const totalWeight = contributions.reduce((sum, c) => sum + c.definition.weight, 0);
  if (totalWeight <= 0) {
    throw new SelaScoringError(
      `Total weight of applicable criteria for technology "${technology}" is ${totalWeight}; cannot compute a weighted score.`,
    );
  }

  const score =
    contributions.reduce((sum, c) => sum + c.definition.weight * c.normalizedScore, 0) / totalWeight;

  // Flow F2 — the single criterion limiting the score most: the one whose
  // shortfall (weight × room for improvement) is largest, i.e. the
  // criterion that would raise the score the most if it were perfect.
  const limiting = pickByWeightThenId(
    contributions.map((c) => ({
      weight: c.definition.weight * (1 - c.normalizedScore),
      id: c.definition.id,
    })),
  );

  return {
    spatialUnitId,
    technology,
    verdict: score >= suitabilityThreshold ? "suitable" : "unsuitable",
    score,
    limitingCriterionId: limiting.id,
    excludedByCriterionId: null,
    methodVersion,
  };
}
