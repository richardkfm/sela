// Every screen or export that surfaces a number derived from
// lib/scoring/illustrative-weights.ts must show this — see that file's
// header comment and CHANGELOG.md [0.3.0].

import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";

export function IllustrativeBanner() {
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
      <strong>{ILLUSTRATIVE_MARKER.de}</strong> — diese Zahlen stammen aus einem synthetischen
      Beispieldatensatz (<code>ingest/fixtures/</code>) mit einer willkürlichen Beispiel-Gewichtung,
      nicht aus einer echten Pilotregion. ({ILLUSTRATIVE_MARKER.en})
    </div>
  );
}
