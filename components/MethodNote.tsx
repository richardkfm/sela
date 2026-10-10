// The note every screen that shows a verdict carries, worded by the kind of
// region the numbers belong to and the Land whose protected areas it reads
// (lib/pilot-region.ts).
//
// On the synthetic fixture, every number comes from lib/scoring/illustrative-
// weights.ts, so the note is the ILLUSTRATIV banner (ILLUSTRATIVE_MARKER). On a
// real region, since roadmap Step 2 (real-pv-v1, 2026-09-28), no placeholder
// reaches the screen: PV is classified by decided rules on real measurements
// and wind is only checked for exclusion. The note is then the advisory line
// CLAUDE.md §5 asks for — calling that illustrative would be false modesty,
// calling the fixture real a false claim.
//
// `compact` is for map surfaces, where the note sits inside a panel rather
// than across the top of a page. It shortens the layout, never the message.
import Link from "next/link";
import type { PilotRegionKind } from "@/lib/pilot-region";
import { ILLUSTRATIVE_MARKER } from "@/lib/scoring/illustrative-weights";

function message(kind: PilotRegionKind, compact: boolean, authorityDe: string) {
  if (kind === "real") {
    return compact ? (
      <>
        Einordnung nach veröffentlichten Regeln auf echten Messwerten (DWD, BKG, {authorityDe}) – beratend,
        keine Planungs- oder Genehmigungsaussage.
      </>
    ) : (
      <>
        Diese Einordnung folgt veröffentlichten, entschiedenen Regeln auf echten Messwerten (DWD, BKG,{" "}
        {authorityDe}). Sie ist beratend: keine Planungs-, Eignungs- oder Genehmigungsaussage. Wind ist noch nicht
        bewertet, nur auf Ausschlüsse geprüft.
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

function Lead({ kind }: { kind: PilotRegionKind }) {
  return kind === "real" ? (
    <>
      <strong>Beratend</strong> —{" "}
    </>
  ) : (
    <>
      <strong>{ILLUSTRATIVE_MARKER.de}</strong> —{" "}
    </>
  );
}

function Tail({ kind }: { kind: PilotRegionKind }) {
  return kind === "real" ? (
    <>
      {" "}
      <Link href="/method">Wie eingeordnet wird →</Link>
    </>
  ) : (
    <> ({ILLUSTRATIVE_MARKER.en})</>
  );
}

/**
 * `authorityDe` names the Land's environment agency whose protected areas the
 * classification reads (lib/pilot-region.ts LAENDER) — LfU Brandenburg, LfULG
 * Sachsen; without one the note names the role instead of guessing a Land.
 */
export function MethodNote({
  compact = false,
  kind = "fixture",
  authorityDe,
}: {
  compact?: boolean;
  kind?: PilotRegionKind;
  authorityDe?: string;
}) {
  const authority = authorityDe ?? "Landesumweltbehörde";
  if (compact) {
    return (
      <div role="note" className="illustrative-note">
        <Lead kind={kind} />
        {message(kind, true, authority)}
        <Tail kind={kind} />
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
      <Lead kind={kind} />
      {message(kind, false, authority)}
      <Tail kind={kind} />
    </div>
  );
}
