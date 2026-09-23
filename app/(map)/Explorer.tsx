"use client";

// The map explorer's state and layout (roadmap §5.1, design-language.md §3):
// a full-bleed map, one quiet panel on the left that says what the colours
// mean and lists every unit, and — once a unit is chosen — one card on the
// right that says *why*, with the way on to the comparison.
//
// State lives here rather than in Map.tsx so the map, the legend, the list
// and the selection card can never disagree about which technology is shown
// or which unit is selected.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import type { BBox, GeoJSONFeatureCollection } from "@/lib/db/queries/spatial-units";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE, type MapVerdict } from "@/lib/map/verdict-style";
import { TECHNOLOGIES, type SuitabilityVerdict, type Technology } from "@/lib/scoring/types";
import { Legend } from "./Legend";
import { Map, type FocusRequest, type FramePadding, type HoverInfo } from "./Map";
import { SelectionPanel } from "./SelectionPanel";
import { TechnologySwitch } from "@/components/TechnologySwitch";
import { UnitList } from "./UnitList";

// Panel widths in CSS match these (globals.css .explorer-*); the map pads its
// framing by them so a selected unit never lands underneath a panel.
const WIDE_PADDING: FramePadding = { top: 48, right: 64, bottom: 48, left: 400 };
const WIDE_PADDING_WITH_SELECTION: FramePadding = { ...WIDE_PADDING, right: 400 };
const NARROW_PADDING: FramePadding = { top: 32, right: 32, bottom: 320, left: 32 };

export function Explorer({
  units,
  initialVerdicts,
  initialTechnology,
  sampleExtent,
  regionName,
}: {
  units: GeoJSONFeatureCollection;
  initialVerdicts: SuitabilityVerdict[];
  initialTechnology: Technology;
  sampleExtent: BBox | null;
  regionName: string;
}) {
  const [technology, setTechnology] = useState<Technology>(initialTechnology);
  const [verdictsByTech, setVerdictsByTech] = useState<Partial<Record<Technology, SuitabilityVerdict[]>>>({
    [initialTechnology]: initialVerdicts,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const nonce = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const verdicts = verdictsByTech[technology] ?? [];
  const verdictByUnit = useMemo(() => new globalThis.Map(verdicts.map((v) => [v.spatialUnitId, v])), [verdicts]);
  const featureById = useMemo(() => new globalThis.Map(units.features.map((f) => [f.id, f])), [units]);

  const changeTechnology = useCallback(
    async (next: Technology) => {
      setTechnology(next);
      setAnnouncement(`Karte zeigt jetzt die Eignung für ${TECHNOLOGY_LABEL_DE[next]}.`);
      if (verdictsByTech[next]) return;
      const response = await fetch(`/api/units/verdicts?technology=${next}`);
      if (!response.ok) return;
      const fetched: SuitabilityVerdict[] = await response.json();
      setVerdictsByTech((current) => ({ ...current, [next]: fetched }));
    },
    [verdictsByTech],
  );

  const select = useCallback(
    (id: string | null, options: { frame: boolean } = { frame: false }) => {
      setSelectedId(id);
      if (!id) return;
      const bbox = featureById.get(id)?.properties.bbox as BBox | undefined;
      if (options.frame && bbox) setFocus({ kind: "bbox", bbox, nonce: ++nonce.current });
    },
    [featureById],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const result: Record<MapVerdict, number> = { suitable: 0, unsuitable: 0, excluded: 0, unscored: 0 };
    for (const feature of units.features) {
      result[verdictByUnit.get(feature.id)?.verdict ?? "unscored"] += 1;
    }
    return result;
  }, [units, verdictByUnit]);

  const padding = narrow ? NARROW_PADDING : selectedId ? WIDE_PADDING_WITH_SELECTION : WIDE_PADDING;
  const hovered = hover ? verdictByUnit.get(hover.id) : undefined;
  const selectedFeature = selectedId ? featureById.get(selectedId) : undefined;

  return (
    <div className="map-stage">
      <Map
        units={units}
        verdicts={verdicts}
        technology={technology}
        selectedId={selectedId}
        hoveredId={hover?.id ?? null}
        focus={focus}
        framePadding={padding}
        onSelect={(id) => select(id)}
        onHover={setHover}
      />

      <aside className="panel explorer-side" aria-label="Legende und Flächenliste">
        <header className="explorer-masthead">
          <p className="wordmark">sela</p>
          <h1>Flächen im Vergleich</h1>
          <p className="muted">
            Pilotregion {regionName} · Eignung, Erhalt und Renaturierung nebeneinander
          </p>
        </header>

        <IllustrativeBanner compact />

        <section aria-labelledby="tech-heading" className="explorer-section">
          <h2 id="tech-heading" className="overline">
            Karte zeigt Eignung für
          </h2>
          <TechnologySwitch value={technology} onChange={changeTechnology} options={TECHNOLOGIES} />
        </section>

        <Legend technology={technology} counts={counts} total={units.features.length} />

        <section aria-labelledby="view-heading" className="explorer-section">
          <h2 id="view-heading" className="overline">
            Ausschnitt
          </h2>
          <div className="explorer-views">
            <button type="button" className="btn btn-small" onClick={() => setFocus({ kind: "region", nonce: ++nonce.current })}>
              {regionName}
            </button>
            {sampleExtent && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setFocus({ kind: "bbox", bbox: sampleExtent, nonce: ++nonce.current })}
              >
                Beispielflächen
              </button>
            )}
          </div>
          <p className="explorer-note muted">
            In der Pilotregion sind noch keine Flächen bewertet. Die {units.features.length} Beispielflächen liegen
            bewusst bei 0° N 0° O, damit sie nicht mit einem echten Ort verwechselt werden.
          </p>
        </section>

        <UnitList
          units={units}
          verdictByUnit={verdictByUnit}
          technology={technology}
          selectedId={selectedId}
          onSelect={(id) => select(id, { frame: true })}
        />
      </aside>

      {selectedId && selectedFeature && (
        <SelectionPanel
          key={selectedId}
          id={selectedId}
          areaHa={selectedFeature.properties.areaHa as number | undefined}
          technology={technology}
          onClose={() => setSelectedId(null)}
        />
      )}

      {hover && (
        <div className="panel map-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          <span className="tabular-nums">{hover.id.slice(0, 8)}</span>
          <span className="muted"> · </span>
          <span>{VERDICT_LABEL_DE[hovered?.verdict ?? "unscored"]}</span>
          {hovered?.score != null && <span className="muted tabular-nums"> · {hovered.score.toFixed(2)}</span>}
        </div>
      )}

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
