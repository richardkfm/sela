"use client";

// Flow F1 (mvp.md): find land by Gemeinde or by coordinates. One field, a
// short list of matches below it — no autocomplete popover over the map, so
// the list is ordinary buttons in the panel's reading order and needs no
// combobox semantics to be keyboard- and screen-reader-usable (design-language.md §9).
// Address search is not offered: it needs a geocoder, a new data source behind
// its own gate (roadmap Step 5).

import { useEffect, useRef, useState } from "react";
import type { Municipality } from "@/lib/db/queries/municipalities";

interface SearchResult {
  municipalities: Municipality[];
  coordinate: { readAsDe: string; unitId: string | null } | null;
}

export function SearchBox({
  region,
  onMunicipality,
  onUnit,
}: {
  region: string;
  onMunicipality: (municipality: Municipality) => void;
  onUnit: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState("");
  const request = useRef(0);

  // Gemeinde names are matched as the reader types; a coordinate is only
  // placed on submit, because a half-typed number is a different point.
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) {
      setResult(null);
      return;
    }
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/search?region=${encodeURIComponent(region)}&q=${encodeURIComponent(q)}`);
      if (!response.ok || id !== request.current) return;
      const data: SearchResult = await response.json();
      setResult(data);
      if (data.coordinate === null) {
        setStatus(
          data.municipalities.length === 0
            ? "Keine Gemeinde gefunden."
            : `${data.municipalities.length} Gemeinde${data.municipalities.length === 1 ? "" : "n"} gefunden.`,
        );
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [text, region]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = text.trim();
    if (q === "") return;
    const response = await fetch(`/api/search?region=${encodeURIComponent(region)}&q=${encodeURIComponent(q)}`);
    if (!response.ok) return;
    const data: SearchResult = await response.json();
    setResult(data);
    if (data.coordinate) {
      if (data.coordinate.unitId) {
        setStatus(`Koordinate ${data.coordinate.readAsDe}. Fläche ausgewählt.`);
        onUnit(data.coordinate.unitId);
      } else {
        setStatus(`Koordinate ${data.coordinate.readAsDe} – dieser Punkt liegt in keiner Fläche der Pilotregion.`);
      }
      return;
    }
    const first = data.municipalities[0];
    if (data.municipalities.length === 1 && first) onMunicipality(first);
  };

  return (
    <section aria-labelledby="search-heading" className="explorer-section">
      <h2 id="search-heading" className="overline">
        Fläche finden
      </h2>
      <form role="search" className="search-form" onSubmit={submit}>
        <label htmlFor="search-input" className="visually-hidden">
          Gemeinde oder Koordinaten
        </label>
        <input
          id="search-input"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Gemeinde oder Koordinaten"
          autoComplete="off"
          aria-describedby="search-help"
        />
        <button type="submit" className="btn btn-small">
          Suchen
        </button>
      </form>
      <p id="search-help" className="explorer-note muted">
        Zum Beispiel „Prenzlau“, „53,31 13,86“ oder „33U 412345 5881234“ (ETRS89/UTM). Adresssuche gibt es noch nicht.
      </p>
      {result && result.municipalities.length > 0 && (
        <ul className="search-results">
          {result.municipalities.map((m) => (
            <li key={m.ags}>
              <button type="button" onClick={() => onMunicipality(m)}>
                <span>{m.name}</span>
                <span className="muted"> · {m.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {result?.coordinate && <p className="explorer-note muted">{status}</p>}
      <div className="visually-hidden" aria-live="polite">
        {status}
      </div>
    </section>
  );
}
