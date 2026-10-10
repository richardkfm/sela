"use client";

// First steps, for a reader who has never seen sela (mvp.md §2, "the
// public"; roadmap-planning-tool.md Phase 3): the four questions sela answers
// (CLAUDE.md §1) in one sentence each, and what to do first. Folded away once
// read — the panel stays quiet (design-language.md §3) — and remembered per
// browser only as a convenience, never as state the product depends on.
//
// Beside it, the handful of things a planner needs to know that the map does
// not show: how to group cells, how to export, that the link is the view.

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "sela.intro.folded";

export function Intro({ regionKind }: { regionKind: "real" | "fixture" }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setOpen(false);
    } catch {
      // Private window or blocked storage: the intro simply opens.
    }
  }, []);
  const toggle = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "0" : "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="explorer-intro">
      <details open={open} onToggle={(event) => toggle((event.target as HTMLDetailsElement).open)}>
        <summary className="overline">So lesen Sie die Karte</summary>
        <ul className="intro-list">
          <li>
            <strong>Jede Zelle ist 100 m breit.</strong> Die Farbe sagt, ob für die gewählte Technologie etwas gegen eine
            Anlage spricht — nach Bodenbedeckung und Schutzgebieten, nicht nach einer Punktzahl.
          </li>
          <li>
            <strong>Weit herausgezoomt</strong> zeigt eine Wabe die häufigste Einordnung ihrer Zellen. Erst ab Zoomstufe 12
            lässt sich eine Zelle anwählen.
          </li>
          <li>
            <strong>Eine Zelle anklicken</strong> zeigt, warum sie so eingeordnet ist, und führt zum Vergleich: Was wird
            gewonnen, wenn gebaut wird? Was bleibt, wenn nicht? Was verbessert sich, wenn renaturiert wird?
          </li>
          <li>
            <strong>Nichts hier ist eine Genehmigung</strong> oder eine Planungsaussage.{" "}
            <Link href="/method">Wie eingeordnet wird →</Link>
          </li>
        </ul>
        {regionKind === "real" && (
          <p className="explorer-note muted">
            Anfangen: oben die eigene Gemeinde suchen, dann hineinzoomen.
          </p>
        )}
      </details>
      <details>
        <summary className="overline">Für Planende</summary>
        <ul className="intro-list">
          <li>
            <strong>Mehrere Zellen</strong> mit gedrückter Umschalttaste anklicken; sie lassen sich als eine Fläche
            zusammenfassen oder nebeneinander vergleichen.
          </li>
          <li>
            <strong>Nur das Gesuchte zeigen:</strong> unter der Legende lässt sich die Anzeige auf Zellen ohne
            Einschränkung oder ohne Prüfhinweis beschränken. Die Zahlen in der Legende bleiben dabei vollständig.
          </li>
          <li>
            <strong>Mitnehmen:</strong> eine zusammengefasste Fläche gibt es als GeoJSON oder CSV mit allen Werten und
            Quellen; der Link dieser Seite enthält Gebiet, Ausschnitt und Auswahl.
          </li>
        </ul>
      </details>
    </div>
  );
}
