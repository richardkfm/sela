"use client";

// Several cells chosen together (roadmap Step 5): the practical answer to
// ADR-0001's admitted gap — a hex cell is not what a council names — until
// Flurstück geometry is affordable. The group is summarised as one site, or
// its cells are placed side by side under one scenario (mvp.md F6).

import Link from "next/link";
import { MAX_GROUP_CELLS, MAX_SIDE_BY_SIDE } from "@/lib/search/group";

export function GroupPanel({
  ids,
  selectedId,
  onSelect,
  onRemove,
  onClear,
}: {
  ids: readonly string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const query = ids.join(",");
  return (
    <section aria-labelledby="group-heading" className="explorer-section">
      <h2 id="group-heading" className="overline">
        Mehrere Zellen <span className="tabular-nums">({ids.length})</span>
      </h2>
      {ids.length === 0 ? (
        <p className="explorer-note muted">
          Mit gedrückter Umschalttaste in die Karte klicken oder bei einer ausgewählten Fläche „Zu mehreren Zellen
          hinzufügen“ wählen, um bis zu {MAX_GROUP_CELLS} Zellen als eine Fläche zusammenzufassen.
        </p>
      ) : (
        <>
          <ul className="unit-list">
            {ids.map((id) => (
              <li key={id} className="group-item">
                <button type="button" aria-current={selectedId === id ? "true" : undefined} onClick={() => onSelect(id)}>
                  <span aria-hidden className="swatch swatch-group" />
                  <span className="tabular-nums">{id.slice(0, 8)}</span>
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => onRemove(id)} aria-label={`Zelle ${id.slice(0, 8)} entfernen`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="explorer-views">
            <Link className="btn btn-small" href={`/site?ids=${query}`}>
              Als eine Fläche zusammenfassen
            </Link>
            {ids.length >= 2 && ids.length <= MAX_SIDE_BY_SIDE && (
              <Link className="btn btn-small" href={`/compare?ids=${query}&scenario=develop_pv`}>
                Nebeneinander vergleichen
              </Link>
            )}
            <button type="button" className="btn btn-small" onClick={onClear}>
              Leeren
            </button>
          </div>
          {ids.length > MAX_SIDE_BY_SIDE && (
            <p className="explorer-note muted">
              Nebeneinander passen höchstens {MAX_SIDE_BY_SIDE} Zellen; zusammenfassen geht mit bis zu {MAX_GROUP_CELLS}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
