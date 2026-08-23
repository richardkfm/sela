// Confidence vocabulary (design-language.md §8): an explicit marker glyph,
// never colour alone, and never false precision — a number with low
// confidence looks visibly different from one with high confidence.

import type { Confidence } from "@/lib/scoring/types";

const GLYPH: Record<Confidence, string> = { high: "●", medium: "◐", low: "○" };
const LABEL_DE: Record<Confidence, string> = { high: "hoch", medium: "mittel", low: "niedrig" };
const OPACITY: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.5 };

export function ConfidenceMark({ confidence }: { confidence: Confidence }) {
  return (
    <span
      style={{ opacity: OPACITY[confidence], fontSize: "0.85rem", color: "var(--text-secondary)" }}
      title={`Konfidenz: ${LABEL_DE[confidence]}`}
    >
      <span aria-hidden>{GLYPH[confidence]}</span> Konfidenz: {LABEL_DE[confidence]}
    </span>
  );
}
