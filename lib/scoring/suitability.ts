// Per-technology suitability (flow F2) and the ADR-0004 filter path.
// Pure arithmetic over already-computed criterion values — see
// docs/architecture/adr-0002-geodata-stack.md and
// docs/architecture/adr-0004-constraints-as-filters.md.

import type {
  CriterionDefinition,
  CriterionValue,
  CategoryClass,
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
  /**
   * Category criteria only (ADR-0009): the class the unit's value falls in.
   * `not_considered` takes the unit out of the method; `restricted` and
   * `unrestricted` classify it when no weighted criterion applies. Ignored for
   * every other criterion.
   */
  readonly categoryClass?: CategoryClass;
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
  /**
   * Flow F2's limiting-criterion rule (decision memo Q5). Without it, a
   * criterion's gap is measured against a perfect 1 and one is always named.
   * With it, the gap is measured against the best normalised value of that
   * criterion in the compared land (`computeLimitingReference`), and a
   * criterion is named only when its gap is at least `minGap`.
   */
  readonly limitingReference?: LimitingReference;
}

export interface LimitingReference {
  /** Best normalised value per scored criterion id in the compared land. */
  readonly best: ReadonlyMap<string, number>;
  readonly minGap: number;
}

type Gate =
  | { readonly kind: "excluded" | CategoryClass; readonly criterionId: string }
  | { readonly kind: "scored"; readonly contributions: readonly Contribution[] };

const CATEGORY_ORDER: Record<CategoryClass, number> = { not_considered: 0, restricted: 1, unrestricted: 2 };

interface Contribution {
  readonly definition: CriterionDefinition;
  readonly normalizedScore: number;
}

/**
 * Flow F2 up to the score: hard constraints first (a statute outranks a
 * classification), then category criteria, then the normalised contribution
 * of every weighted criterion present. Where no weighted criterion applies
 * (weight 0 marks a criterion as measured, not scored), the unit is classified
 * by its categories instead — the most restrictive class wins.
 */
function gate(
  spatialUnitId: string,
  technology: Technology,
  values: readonly CriterionValue[],
  definitions: readonly CriterionDefinition[],
  normalize: Normalize,
): Gate {
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
    return { kind: "excluded", criterionId: pickByWeightThenId(violated).definition.id };
  }

  // A category criterion without a value is not evidence either way (as above).
  const categories = applicable.filter((d) => d.isCategory).sort((a, b) => a.id.localeCompare(b.id));
  const classes: { criterionId: string; categoryClass: CategoryClass }[] = [];
  for (const definition of categories) {
    const value = valueByCriterionId.get(definition.id);
    const categoryClass = value ? normalize(value, definition).categoryClass : undefined;
    if (categoryClass) classes.push({ criterionId: definition.id, categoryClass });
  }
  classes.sort((a, b) => CATEGORY_ORDER[a.categoryClass] - CATEGORY_ORDER[b.categoryClass]);
  const mostRestrictive = classes[0];
  if (mostRestrictive?.categoryClass === "not_considered") {
    return { kind: "not_considered", criterionId: mostRestrictive.criterionId };
  }

  const scored = applicable.filter((d) => !d.isHardConstraint && !d.isCategory && d.weight > 0);
  const contributions: Contribution[] = [];
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
  // No weighted value for this unit — decided by what is present, never by
  // which definitions exist (another region's weighted criteria may apply to
  // the same technology): the unit is classified by its categories.
  if (contributions.length === 0 && mostRestrictive) {
    return { kind: mostRestrictive.categoryClass, criterionId: mostRestrictive.criterionId };
  }
  if (contributions.length === 0) {
    throw new SelaScoringError(
      `No scoreable criterion values available for spatial unit "${spatialUnitId}", technology "${technology}" — cannot compute a suitability verdict.`,
    );
  }
  return { kind: "scored", contributions };
}

/**
 * Computes one technology's suitability verdict for one spatial unit.
 *
 * A criterion with no `CriterionValue` present for this spatial unit takes
 * no part in the exclusion check, the category check or the score — absence
 * is not evidence of anything, so it is never treated as satisfying or
 * violating a constraint, and never silently contributes a favourable or
 * unfavourable score.
 */
export function computeSuitability(params: ComputeSuitabilityParams): SuitabilityVerdict {
  const { spatialUnitId, technology, values, definitions, normalize, suitabilityThreshold, methodVersion, limitingReference } =
    params;

  if (suitabilityThreshold < 0 || suitabilityThreshold > 1) {
    throw new SelaScoringError(
      `suitabilityThreshold must be within [0, 1], got ${suitabilityThreshold}`,
    );
  }

  const gated = gate(spatialUnitId, technology, values, definitions, normalize);
  if (gated.kind !== "scored") {
    return {
      spatialUnitId,
      technology,
      verdict: gated.kind,
      score: null,
      limitingCriterionId: null,
      excludedByCriterionId: gated.criterionId,
      methodVersion,
    };
  }
  const { contributions } = gated;

  const totalWeight = contributions.reduce((sum, c) => sum + c.definition.weight, 0);
  if (totalWeight <= 0) {
    throw new SelaScoringError(
      `Total weight of applicable criteria for technology "${technology}" is ${totalWeight}; cannot compute a weighted score.`,
    );
  }

  const score =
    contributions.reduce((sum, c) => sum + c.definition.weight * c.normalizedScore, 0) / totalWeight;

  // Flow F2 — the criterion limiting the score most: the one whose weighted
  // gap (weight × distance below its reference) is largest. The reference is
  // a perfect 1, or — under the Q5 rule — the best value of that criterion in
  // the compared land, and then only a gap of at least `minGap` is named.
  const minGap = limitingReference?.minGap ?? 0;
  const candidates = contributions
    .map((c) => ({ c, gap: (limitingReference?.best.get(c.definition.id) ?? 1) - c.normalizedScore }))
    .filter(({ gap }) => gap >= minGap)
    .map(({ c, gap }) => ({ weight: c.definition.weight * gap, id: c.definition.id }));
  const limiting = candidates.length > 0 ? pickByWeightThenId(candidates) : null;

  return {
    spatialUnitId,
    technology,
    verdict: score >= suitabilityThreshold ? "suitable" : "unsuitable",
    score,
    limitingCriterionId: limiting?.id ?? null,
    excludedByCriterionId: null,
    methodVersion,
  };
}

/**
 * The Q5 reference: for each scored criterion, the best normalised value
 * among the units that receive a score for this technology — the compared
 * land. Excluded and not-considered units take no part: their values are not
 * what a scored unit is compared against.
 */
export function computeLimitingReference(params: {
  readonly technology: Technology;
  readonly valuesByUnit: ReadonlyMap<string, readonly CriterionValue[]>;
  readonly definitions: readonly CriterionDefinition[];
  readonly normalize: Normalize;
}): Map<string, number> {
  const { technology, valuesByUnit, definitions, normalize } = params;
  const best = new Map<string, number>();
  for (const [spatialUnitId, values] of valuesByUnit) {
    let gated: Gate;
    try {
      gated = gate(spatialUnitId, technology, values, definitions, normalize);
    } catch (err) {
      if (err instanceof SelaScoringError) continue;
      throw err;
    }
    if (gated.kind !== "scored") continue;
    for (const { definition, normalizedScore } of gated.contributions) {
      best.set(definition.id, Math.max(best.get(definition.id) ?? 0, normalizedScore));
    }
  }
  return best;
}
