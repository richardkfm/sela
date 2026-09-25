// Confidence vocabulary (design-language.md §8): an explicit marker glyph,
// never colour alone, and never false precision — a number with low
// confidence looks visibly different from one with high confidence.

import type { Confidence } from "@/lib/scoring/types";

const GLYPH: Record<Confidence, string> = { high: "●", medium: "◐", low: "○" };
const LABEL_DE: Record<Confidence, string> = { high: "hoch", medium: "mittel", low: "niedrig" };
const OPACITY: Record<Confidence, number> = { high: 1, medium: 0.75, low: 0.5 };

/**
 * `compact` is for table cells beside a value: the glyph alone, with the words
 * kept for screen readers and as a tooltip. The table's caption decodes the glyphs.
 */
export function ConfidenceMark({ confidence, compact = false }: { confidence: Confidence; compact?: boolean }) {
  if (compact) {
    return (
      <span style={{ color: "var(--text-secondary)" }} title={`Konfidenz: ${LABEL_DE[confidence]}`}>
        <span aria-hidden style={{ opacity: OPACITY[confidence] }}>
          {GLYPH[confidence]}
        </span>
        <span className="visually-hidden">Konfidenz: {LABEL_DE[confidence]}</span>
      </span>
    );
  }
  return (
    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }} title={`Konfidenz: ${LABEL_DE[confidence]}`}>
      {/* Only the glyph fades with confidence; the words stay at full contrast
          (WCAG 1.4.3 — faded text failed axe once this mark sat on real values). */}
      <span aria-hidden style={{ opacity: OPACITY[confidence] }}>
        {GLYPH[confidence]}
      </span>{" "}
      Konfidenz: {LABEL_DE[confidence]}
    </span>
  );
}
