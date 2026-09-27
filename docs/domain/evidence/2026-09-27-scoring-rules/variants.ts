// Scratch: recompute PV verdicts for irradiation-bound variants using the repo's own
// computeSuitability + illustrativeNormalize (only pv_irradiation_annual bounds overridden).
// Usage (from the repo root): pnpm exec tsx <this file> '<json of variants>'
import { getPool } from "../../../../lib/db/client";
import { listCriterionDefinitions, listCriterionValuesForPilotRegion } from "../../../../lib/db/queries/criteria";
import { listSpatialUnitIds } from "../../../../lib/db/queries/spatial-units";
import { computeSuitability, type Normalize } from "../../../../lib/scoring/suitability";
import {
  ILLUSTRATIVE_SUITABILITY_THRESHOLD,
  illustrativeNormalize,
} from "../../../../lib/scoring/illustrative-weights";
import { SelaScoringError, TECHNOLOGIES, type CriterionValue } from "../../../../lib/scoring/types";

type Variant = { name: string; bounds?: { min: number; max: number }; dropIrradiation?: boolean };

const variants: Variant[] = JSON.parse(process.argv[2]!);
const region = "uckermark-12073";

async function main() {
  const [unitIds, allDefs] = await Promise.all([listSpatialUnitIds(region), listCriterionDefinitions()]);
  const defs = allDefs.filter((d) => d.appliesTo.some((t) => (TECHNOLOGIES as readonly string[]).includes(t)));
  const values = await listCriterionValuesForPilotRegion(region, defs.map((d) => d.id));
  const byUnit = new Map<string, CriterionValue[]>();
  for (const v of values) (byUnit.get(v.spatialUnitId) ?? byUnit.set(v.spatialUnitId, []).get(v.spatialUnitId)!).push(v);

  const out: Record<string, unknown> = {};
  for (const variant of variants) {
    const normalize: Normalize = (value, def) => {
      if (def.id === "pv_irradiation_annual" && variant.bounds) {
        const { min, max } = variant.bounds;
        const s = Math.min(Math.max((value.value - min) / (max - min), 0), 1);
        return { normalizedScore: s, violatesConstraint: false };
      }
      return illustrativeNormalize(value, def);
    };
    const vdefs = variant.dropIrradiation ? defs.filter((d) => d.id !== "pv_irradiation_annual") : defs;
    const verdicts: Record<string, number> = {};
    const limiting: Record<string, number> = {};
    const excludedBy: Record<string, number> = {};
    let skipped = 0;
    const scores: number[] = [];
    const shortfalls: Record<string, number[]> = {};
    let suitableWithLandCoverZero = 0;
    for (const id of unitIds) {
      try {
        const r = computeSuitability({
          spatialUnitId: id, technology: "pv", values: byUnit.get(id) ?? [], definitions: vdefs,
          normalize, suitabilityThreshold: ILLUSTRATIVE_SUITABILITY_THRESHOLD, methodVersion: "scratch",
        });
        verdicts[r.verdict] = (verdicts[r.verdict] ?? 0) + 1;
        if (r.limitingCriterionId) { const k = r.verdict + ':' + r.limitingCriterionId; limiting[k] = (limiting[k] ?? 0) + 1; }
        if (r.excludedByCriterionId) excludedBy[r.excludedByCriterionId] = (excludedBy[r.excludedByCriterionId] ?? 0) + 1;
        if (r.score !== null) scores.push(r.score);
        if (r.verdict === 'suitable') {
          const lc = (byUnit.get(id) ?? []).find((x) => x.criterionId === 'pv_land_cover');
          const lcd = vdefs.find((x) => x.id === 'pv_land_cover')!;
          if (lc && normalize(lc, lcd).normalizedScore === 0) suitableWithLandCoverZero++;
        }
        if (r.limitingCriterionId) {
          const v = (byUnit.get(id) ?? []).find((x) => x.criterionId === r.limitingCriterionId)!;
          const d = vdefs.find((x) => x.id === r.limitingCriterionId)!;
          const k = r.verdict + ':' + r.limitingCriterionId;
          (shortfalls[k] ??= []).push(1 - normalize(v, d).normalizedScore);
        }
      } catch (e) {
        if (e instanceof SelaScoringError) { skipped++; continue; }
        throw e;
      }
    }
    // limiting split by verdict
    const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]!.toFixed(4); };
    const shortfallStats = Object.fromEntries(Object.entries(shortfalls).map(([k, a]) => [k, { n: a.length, min: q(a, 0), p50: q(a, 0.5), max: q(a, 1), nBelow0_05: a.filter((x) => x < 0.05).length }]));
    out[variant.name] = { units: unitIds.length, verdicts, limiting, excludedBy, skipped, scoredCells: scores.length, shortfallStats, scoreMin: q(scores,0), scoreP50: q(scores,0.5), scoreMax: q(scores,1), suitableWithLandCoverZero };
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => getPool().end());
