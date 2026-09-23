// Every screen or export that surfaces a number derived from
// lib/scoring/illustrative-weights.ts must show this — see that file's
// header comment and CHANGELOG.md [0.3.0].
//
// `compact` is for map surfaces, where the note sits inside a panel rather
// than across the top of a page. It shortens the layout, never the message:
// the marker and the reason are both still there.

import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";

export function IllustrativeBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div role="note" className="illustrative-note">
        <strong>{ILLUSTRATIVE_MARKER.de}</strong> — synthetischer Beispieldatensatz (<code>ingest/fixtures/</code>)
        mit willkürlicher Beispiel-Gewichtung, keine echte Pilotregion. ({ILLUSTRATIVE_MARKER.en})
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
      <strong>{ILLUSTRATIVE_MARKER.de}</strong> — diese Zahlen stammen aus einem synthetischen
      Beispieldatensatz (<code>ingest/fixtures/</code>) mit einer willkürlichen Beispiel-Gewichtung,
      nicht aus einer echten Pilotregion. ({ILLUSTRATIVE_MARKER.en})
    </div>
  );
}
