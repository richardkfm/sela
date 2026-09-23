"use client";

// The selected unit, in one card: all three technologies side by side (never
// one in isolation — CLAUDE.md §4.2), each with the single criterion that
// limits or excludes it (flow F2), and the way on. The one accent action is
// the scenario comparison, because comparison is the product
// (design-language.md §3: "one accent action per screen"); the 3D preview and
// the evidence are secondary.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TechnologySwatch } from "@/components/TechnologySwitch";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE } from "@/lib/map/verdict-style";
import type { PilotRegionKind } from "@/lib/pilot-region";
import { TECHNOLOGIES, type SuitabilityVerdict, type Technology } from "@/lib/scoring/types";

interface Summary {
  id: string;
  kind: "hex_grid" | "flurstueck";
  areaHa: number | null;
  methodVersion: string;
  verdicts: (SuitabilityVerdict & {
    reason: { id: string; nameDe: string; kind: "excluded_by" | "limited_by" } | null;
  })[];
}

type SummaryVerdict = Summary["verdicts"][number];

/**
 * Why a technology has no verdict on this unit. In a real region wind has no
 * source for its resource, so it is only ever *excluded* — outside a protected
 * area there is no row at all. Saying so keeps all three technologies in view
 * (CLAUDE.md §4.2) instead of silently dropping one.
 */
function unscoredReason(technology: Technology, regionKind: PilotRegionKind): string {
  if (regionKind === "real" && technology === "wind") return "Keine Quelle für die Windressource – nur Ausschlüsse geprüft";
  return "Für diese Technologie liegt keine Bewertung vor";
}

const AREA_FORMAT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function SelectionPanel({
  id,
  technology,
  regionKind,
  onClose,
}: {
  id: string;
  technology: Technology;
  regionKind: PilotRegionKind;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/unit/${id}/summary`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: Summary) => !cancelled && setSummary(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Move focus to the card so a keyboard or screen-reader user lands on what they just selected.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="panel explorer-selection" aria-labelledby="selection-heading">
      <div className="selection-head">
        <div>
          <p className="overline">Ausgewählte Fläche</p>
          <h2 id="selection-heading" ref={headingRef} tabIndex={-1}>
            Fläche <span className="tabular-nums">{id.slice(0, 8)}</span>
          </h2>
          <p className="muted selection-meta">
            {summary?.kind === "flurstueck" ? "Flurstück" : "Rastereinheit"}
            {summary?.areaHa != null && (
              <>
                {" · "}
                <span className="tabular-nums">{AREA_FORMAT.format(summary.areaHa)}&nbsp;ha</span>
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={onClose} aria-label="Auswahl aufheben">
          ✕
        </button>
      </div>

      <h3 className="overline">Eignung je Technologie · illustrativ</h3>
      {failed && <p>Die Angaben zu dieser Fläche konnten nicht geladen werden.</p>}
      {!summary && !failed && <p className="muted">Lädt …</p>}
      {summary && (
        <ul className="verdict-list">
          {TECHNOLOGIES.map((tech) => {
            const verdict: SummaryVerdict | undefined = summary.verdicts.find((v) => v.technology === tech);
            return (
              <li key={tech} aria-current={tech === technology ? "true" : undefined}>
                <TechnologySwatch technology={tech} />
                <div>
                  <div className="verdict-line">
                    <span>{TECHNOLOGY_LABEL_DE[tech]}</span>
                    <strong>{VERDICT_LABEL_DE[verdict?.verdict ?? "unscored"]}</strong>
                    {verdict?.score != null && <span className="muted tabular-nums">{verdict.score.toFixed(2)}</span>}
                  </div>
                  {verdict?.reason && (
                    <div className="verdict-reason muted">
                      {verdict.reason.kind === "excluded_by" ? "Ausgeschlossen durch " : "Begrenzt durch "}
                      <Link href={`/criterion/${verdict.reason.id}`}>{verdict.reason.nameDe}</Link>
                    </div>
                  )}
                  {!verdict && <div className="verdict-reason muted">{unscoredReason(tech, regionKind)}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="selection-actions">
        <Link className="btn btn-primary" href={`/unit/${id}/compare`}>
          Szenarien vergleichen →
        </Link>
        <div className="selection-secondary">
          <Link className="btn" href={`/unit/${id}/preview?technology=${technology}`}>
            3D-Vorschau
          </Link>
          <Link className="btn" href={`/unit/${id}`}>
            Begründung
          </Link>
        </div>
      </div>
      {summary && (
        <p className="explorer-note muted">
          Methode <span className="tabular-nums">{summary.methodVersion}</span> ·{" "}
          {regionKind === "real" ? "echte Messwerte, " : ""}Beispiel-Gewichtung, keine Aussage über eine Genehmigung.
        </p>
      )}
    </section>
  );
}
