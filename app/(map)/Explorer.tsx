"use client";

// The map explorer's state and layout (roadmap §5.1, design-language.md §3):
// a full-bleed map, one quiet panel on the left that says what the colours
// mean and lists the units in view, and — once a unit is chosen — one card on
// the right that says *why*, with the way on to the comparison.
//
// State lives here rather than in Map.tsx so the map, the legend, the list
// and the selection card can never disagree about which technology is shown
// or which unit is selected.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { TechnologySwitch } from "@/components/TechnologySwitch";
import type { RegionSummary, VerdictCounts } from "@/lib/db/queries/regions";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE } from "@/lib/map/verdict-style";
import type { PilotRegionInfo } from "@/lib/pilot-region";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";
import { Legend } from "./Legend";
import { Map, type FocusRequest, type FramePadding, type HoverInfo, type VisibleUnit } from "./Map";
import { SelectionPanel } from "./SelectionPanel";
import { UnitList } from "./UnitList";

// Panel widths in CSS match these (globals.css .explorer-*); the map pads its
// framing by them so a selected unit never lands underneath a panel.
const WIDE_PADDING: FramePadding = { top: 48, right: 64, bottom: 48, left: 400 };
const WIDE_PADDING_WITH_SELECTION: FramePadding = { ...WIDE_PADDING, right: 400 };
const NARROW_PADDING: FramePadding = { top: 32, right: 32, bottom: 320, left: 32 };

const COUNT = new Intl.NumberFormat("de-DE");

export function Explorer({
  region,
  otherRegions,
  initialTechnology,
  initialCounts,
  dataAttribution,
}: {
  region: RegionSummary;
  otherRegions: PilotRegionInfo[];
  initialTechnology: Technology;
  initialCounts: VerdictCounts;
  dataAttribution: string;
}) {
  const [technology, setTechnology] = useState<Technology>(initialTechnology);
  const [countsByTech, setCountsByTech] = useState<Partial<Record<Technology, VerdictCounts>>>({
    [initialTechnology]: initialCounts,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [visible, setVisible] = useState<VisibleUnit[] | null>(null);
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

  const changeTechnology = useCallback(
    async (next: Technology) => {
      setTechnology(next);
      setAnnouncement(`Karte zeigt jetzt die Eignung für ${TECHNOLOGY_LABEL_DE[next]}.`);
      if (countsByTech[next]) return;
      const response = await fetch(`/api/units/stats?region=${encodeURIComponent(region.id)}&technology=${next}`);
      if (!response.ok) return;
      const counts: VerdictCounts = await response.json();
      setCountsByTech((current) => ({ ...current, [next]: counts }));
    },
    [countsByTech, region.id],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Choosing a unit from the list frames it — the reader may not have spotted
  // it on the map. A click on the map does not: the reader is already looking at it.
  const selectFromList = useCallback(async (id: string) => {
    setSelectedId(id);
    const response = await fetch(`/api/unit/${id}/summary`);
    if (!response.ok) return;
    const { bbox } = (await response.json()) as { bbox: [number, number, number, number] | null };
    if (bbox) setFocus({ kind: "bbox", bbox, nonce: ++nonce.current });
  }, []);

  const padding = narrow ? NARROW_PADDING : selectedId ? WIDE_PADDING_WITH_SELECTION : WIDE_PADDING;
  const counts = countsByTech[technology];

  return (
    <div className="map-stage">
      <Map
        key={region.id}
        region={region.id}
        regionBBox={region.bbox}
        dataAttribution={dataAttribution}
        technology={technology}
        selectedId={selectedId}
        hoveredId={hover?.id ?? null}
        focus={focus}
        framePadding={padding}
        onSelect={setSelectedId}
        onHover={setHover}
        onVisibleUnits={setVisible}
      />

      <aside className="panel explorer-side" aria-label="Legende und Flächenliste">
        <header className="explorer-masthead">
          <p className="wordmark">sela</p>
          <h1>Flächen im Vergleich</h1>
          <p className="muted">
            {region.kind === "real" ? `Pilotregion ${region.nameDe}` : region.nameDe} · Eignung, Erhalt und
            Renaturierung nebeneinander
          </p>
        </header>

        <IllustrativeBanner compact kind={region.kind} />

        <section aria-labelledby="tech-heading" className="explorer-section">
          <h2 id="tech-heading" className="overline">
            Karte zeigt Eignung für
          </h2>
          <TechnologySwitch value={technology} onChange={changeTechnology} options={TECHNOLOGIES} />
          {region.kind === "real" && technology === "agripv" && (
            <p className="explorer-note muted">
              Agri-PV wird noch mit denselben Kriterien wie Solar-PV bewertet – eigene Kriterien (Kultur, Boden)
              haben noch keine Quelle.
            </p>
          )}
          {region.kind === "real" && technology === "wind" && (
            <p className="explorer-note muted">
              Wind wird nicht bewertet: Für die Windressource ist noch keine Quelle festgelegt. Gezeigt werden nur
              Ausschlüsse durch Schutzgebiete.
            </p>
          )}
        </section>

        <Legend technology={technology} counts={counts} total={region.unitCount} />

        <section aria-labelledby="view-heading" className="explorer-section">
          <h2 id="view-heading" className="overline">
            Ausschnitt
          </h2>
          <div className="explorer-views">
            <button type="button" className="btn btn-small" onClick={() => setFocus({ kind: "region", nonce: ++nonce.current })}>
              {region.kind === "real" ? "Ganze Region" : "Ganzer Beispieldatensatz"}
            </button>
            {otherRegions.map((other) => (
              <Link key={other.id} className="btn btn-small" href={`/?region=${other.id}`}>
                {other.kind === "real" ? `Pilotregion ${other.nameDe}` : other.nameDe}
              </Link>
            ))}
          </div>
          <p className="explorer-note muted">
            {region.kind === "real"
              ? `${COUNT.format(region.unitCount)} Rasterzellen à 100 m über den ganzen Landkreis. Die Messwerte sind echt, die Gewichtung ist ein Platzhalter.`
              : `Die ${COUNT.format(region.unitCount)} Beispielflächen liegen bewusst bei 0° N 0° O, damit sie nicht mit einem echten Ort verwechselt werden.`}
          </p>
        </section>

        <UnitList
          units={visible}
          regionUnitCount={region.unitCount}
          technology={technology}
          selectedId={selectedId}
          onSelect={selectFromList}
        />
      </aside>

      {selectedId && (
        <SelectionPanel
          key={selectedId}
          id={selectedId}
          technology={technology}
          regionKind={region.kind}
          onClose={() => setSelectedId(null)}
        />
      )}

      {hover && (
        <div className="panel map-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          <span className="tabular-nums">{hover.id.slice(0, 8)}</span>
          <span className="muted"> · </span>
          <span>{VERDICT_LABEL_DE[hover.verdict]}</span>
          {hover.score != null && <span className="muted tabular-nums"> · {hover.score.toFixed(2)}</span>}
        </div>
      )}

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
