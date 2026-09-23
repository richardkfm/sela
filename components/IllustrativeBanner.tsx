// Every screen or export that surfaces a number derived from
// lib/scoring/illustrative-weights.ts must show this — see that file's
// header comment and CHANGELOG.md [0.3.0].
//
// Worded by the kind of region the number belongs to (lib/pilot-region.ts):
// on the synthetic fixture everything is invented; on a real region the
// measurements are real and only the weighting is a placeholder. Saying the
// first about real data would be false modesty; saying the second about the
// fixture would be a false claim.
//
// `compact` is for map surfaces, where the note sits inside a panel rather
// than across the top of a page. It shortens the layout, never the message.

import type { PilotRegionKind } from "@/lib/pilot-region";
import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";

function message(kind: PilotRegionKind, compact: boolean) {
  if (kind === "real") {
    return compact ? (
      <>
        echte Messwerte (DWD, BKG, LfU Brandenburg), aber eine willkürliche Beispiel-Gewichtung – keine Aussage
        über die Eignung dieser Flächen.
      </>
    ) : (
      <>
        die Messwerte hinter diesen Zahlen sind echt (DWD, BKG, LfU Brandenburg), ihre Gewichtung und die
        Eignungsschwelle sind aber willkürliche Platzhalter. Das Ergebnis ist keine Aussage über die Eignung
        dieser Flächen.
      </>
    );
  }
  return compact ? (
    <>
      synthetischer Beispieldatensatz (<code>ingest/fixtures/</code>) mit willkürlicher Beispiel-Gewichtung, keine
      echte Pilotregion.
    </>
  ) : (
    <>
      diese Zahlen stammen aus einem synthetischen Beispieldatensatz (<code>ingest/fixtures/</code>) mit einer
      willkürlichen Beispiel-Gewichtung, nicht aus einer echten Pilotregion.
    </>
  );
}

export function IllustrativeBanner({ compact = false, kind = "fixture" }: { compact?: boolean; kind?: PilotRegionKind }) {
  if (compact) {
    return (
      <div role="note" className="illustrative-note">
        <strong>{ILLUSTRATIVE_MARKER.de}</strong> — {message(kind, true)} ({ILLUSTRATIVE_MARKER.en})
      </div>
    );
  }
  return (
    <div
      role="note"
      style={{
        border: "1px solid var(--text-secondary)",
        borderRadius: "0.4rem",
        padding: "0.6rem 0.9rem",
        fontSize: "0.85rem",
        color: "var(--text-secondary)",
        background: "var(--surface-1)",
      }}
    >
      <strong>{ILLUSTRATIVE_MARKER.de}</strong> — {message(kind, false)} ({ILLUSTRATIVE_MARKER.en})
    </div>
  );
}
