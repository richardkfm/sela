"use client";

// The map explorer's state and layout (roadmap §5.1, design-language.md §3):
// a full-bleed map, one quiet panel on the left that says where you are, what
// the colours mean and lists the units in view, and — once a unit is chosen —
// one card on the right that says *why*, with the way on to the comparison.
//
// State lives here rather than in Map.tsx so the map, the legend, the list
// and the selection card can never disagree about which technology is shown
// or which unit is selected. The state that makes a view worth sharing —
// technology, map position, selection, group — is mirrored into the URL
// (lib/explorer-url.ts), so a link opens the same way for the next reader.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MethodNote } from "@/components/MethodNote";
import { TechnologySwitch } from "@/components/TechnologySwitch";
import type { Municipality } from "@/lib/db/queries/municipalities";
import type { RegionNode, RegionSummary, VerdictCounts } from "@/lib/db/queries/regions";
import { parseExplorerUrl, serializeExplorerUrl, type MapView } from "@/lib/explorer-url";
import { INTERACTIVE_MIN_ZOOM, CELL_MIN_ZOOM } from "@/lib/map/tiles";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE, type MapVerdict } from "@/lib/map/verdict-style";
import { TECHNOLOGIES, type Technology } from "@/lib/scoring/types";
import { MAX_GROUP_CELLS, toggleInGroup } from "@/lib/search/group";
import { GroupPanel } from "./GroupPanel";
import { Intro } from "./Intro";
import { Legend } from "./Legend";
import { Map, type FocusRequest, type FramePadding, type HoverInfo, type MapFilter, type MapOutline, type VisibleUnit } from "./Map";
import { RegionSwitch } from "./RegionSwitch";
import { SearchBox } from "./SearchBox";
import { SelectionPanel } from "./SelectionPanel";
import { UnitList } from "./UnitList";

// Panel widths in CSS match these (globals.css .explorer-*); the map pads its
// framing by them so a selected unit never lands underneath a panel.
const WIDE_PADDING: FramePadding = { top: 48, right: 64, bottom: 48, left: 400 };
const WIDE_PADDING_WITH_SELECTION: FramePadding = { ...WIDE_PADDING, right: 400 };
const NARROW_PADDING: FramePadding = { top: 32, right: 32, bottom: 320, left: 32 };

const COUNT = new Intl.NumberFormat("de-DE");
const PERCENT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

const NO_FILTER: MapFilter = { onlyClasses: null, withoutFlags: false };

function regionTitle(region: RegionSummary): string {
  if (region.level === "fixture") return region.nameDe;
  if (region.level === "land") return region.nameDe;
  return `${region.bez ?? "Landkreis"} ${region.nameDe}`;
}

export function Explorer({
  region,
  regions,
  initialTechnology,
  initialCounts,
  dataAttribution,
}: {
  region: RegionSummary;
  regions: readonly RegionNode[];
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
  const [view, setView] = useState<MapView | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [group, setGroup] = useState<string[]>([]);
  const [outline, setOutline] = useState<MapOutline | null>(null);
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER);
  const nonce = useRef(0);
  // True once the link's state has been applied; the URL is written only after that,
  // so the first write never overwrites a link with the defaults.
  const restored = useRef(false);

  // The URL follows the state; replaceState, so Back still leaves the explorer.
  useEffect(() => {
    if (!restored.current) return;
    const next = serializeExplorerUrl(region.id, { technology, view, selectedId, group });
    if (window.location.search !== next) window.history.replaceState(window.history.state, "", next);
  }, [region.id, technology, view, selectedId, group]);

  const toggleGroup = useCallback((id: string) => {
    setGroup((current) => {
      const next = toggleInGroup(current, id);
      if (next.length === current.length) {
        setAnnouncement(`Höchstens ${MAX_GROUP_CELLS} Zellen können zusammengefasst werden.`);
      } else {
        setAnnouncement(
          next.length > current.length
            ? `Zelle ${id.slice(0, 8)} hinzugefügt – ${next.length} Zellen ausgewählt.`
            : `Zelle ${id.slice(0, 8)} entfernt – ${next.length} Zellen ausgewählt.`,
        );
      }
      return next;
    });
  }, []);

  // Flow F1: a Gemeinde is framed and outlined; nothing is selected, because a
  // Gemeinde is a place to look, not a unit sela assesses.
  const showMunicipality = useCallback(async (municipality: Municipality) => {
    setFocus({ kind: "bbox", bbox: municipality.bbox, nonce: ++nonce.current, maxZoom: 13 });
    setAnnouncement(`Karte zeigt ${municipality.kind} ${municipality.name}.`);
    const response = await fetch(`/api/municipality/${municipality.ags}`);
    if (!response.ok) return;
    setOutline((await response.json()) as MapOutline);
  }, []);

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
      setAnnouncement(
        `Karte zeigt jetzt die ${region.kind === "real" ? "Einordnung" : "Eignung"} für ${TECHNOLOGY_LABEL_DE[next]}.`,
      );
      if (countsByTech[next]) return;
      const response = await fetch(`/api/units/stats?region=${encodeURIComponent(region.id)}&technology=${next}`);
      if (!response.ok) return;
      const counts: VerdictCounts = await response.json();
      setCountsByTech((current) => ({ ...current, [next]: counts }));
    },
    [countsByTech, region.id],
  );
  // The link's state (lib/explorer-url.ts), applied once after mount — on the
  // client only, so the server's markup and the first client render agree. The
  // map reads the view itself at mount (Map.tsx), so the first framing is the
  // link's; everything else is applied here.
  useEffect(() => {
    const initial = parseExplorerUrl(new URLSearchParams(window.location.search));
    if (initial.technology && initial.technology !== initialTechnology) void changeTechnology(initial.technology);
    if (initial.group.length > 0) setGroup([...initial.group]);
    if (initial.selectedId) {
      if (initial.view) setSelectedId(initial.selectedId);
      else void selectFromList(initial.selectedId);
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const overview = view !== null && view.zoom < CELL_MIN_ZOOM;

  const setClassFilter = (classes: readonly MapVerdict[] | null) =>
    setFilter((current) => ({ ...current, onlyClasses: classes }));

  return (
    <div className="map-stage">
      <Map
        key={region.id}
        region={region.id}
        showBoundary={region.kind === "real"}
        regionBBox={region.bbox}
        dataAttribution={dataAttribution}
        technology={technology}
        selectedId={selectedId}
        hoveredId={hover?.id ?? null}
        focus={focus}
        framePadding={padding}
        groupIds={group}
        outline={outline}
        filter={filter}
        onSelect={setSelectedId}
        onToggleGroup={toggleGroup}
        onHover={setHover}
        onVisibleUnits={setVisible}
        onViewChange={setView}
      />

      <aside className="panel explorer-side" aria-label="Legende und Flächenliste">
        <header className="explorer-masthead">
          <p className="wordmark">sela</p>
          <h1>Flächen im Vergleich</h1>
          <p className="muted explorer-where">
            {region.parent && (
              <>
                <Link href={`/?region=${region.parent.id}`}>{region.parent.nameDe}</Link>
                <span aria-hidden> › </span>
              </>
            )}
            <span>{regionTitle(region)}</span>
          </p>
        </header>

        <MethodNote compact kind={region.kind} authorityDe={region.land?.protectionAuthorityDe} />

        <Intro regionKind={region.kind} />

        {region.kind === "real" && (
          <SearchBox
            region={region.id}
            regionLabel={regionTitle(region)}
            exampleDe={region.land?.searchExampleDe ?? "Prenzlau"}
            onMunicipality={showMunicipality}
            onUnit={selectFromList}
          />
        )}

        <RegionSwitch region={region} regions={regions} />

        <section aria-labelledby="tech-heading" className="explorer-section">
          <h2 id="tech-heading" className="overline">
            Karte zeigt {region.kind === "real" ? "Einordnung" : "Eignung"} für
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

        <Legend
          technology={technology}
          counts={counts}
          total={region.unitCount}
          regionKind={region.kind}
          overview={overview}
          hasOverview={region.hasOverview}
        />

        <section aria-labelledby="filter-heading" className="explorer-section">
          <h2 id="filter-heading" className="overline">
            Anzeige einschränken
          </h2>
          <div className="filter-list">
            {region.kind === "real" && technology !== "wind" && (
              <>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filter.onlyClasses !== null}
                    onChange={(event) => setClassFilter(event.target.checked ? ["unrestricted", "restricted", "suitable"] : null)}
                  />
                  <span>nur Zellen ohne Ausschluss zeigen</span>
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={filter.withoutFlags}
                    onChange={(event) => setFilter((current) => ({ ...current, withoutFlags: event.target.checked }))}
                  />
                  <span>nur Zellen ohne Prüfhinweis zeigen (ab Zoomstufe {INTERACTIVE_MIN_ZOOM})</span>
                </label>
              </>
            )}
            {region.kind === "real" && technology === "wind" && (
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.onlyClasses !== null}
                  onChange={(event) => setClassFilter(event.target.checked ? ["excluded"] : null)}
                />
                <span>nur Ausschlüsse zeigen</span>
              </label>
            )}
            {region.kind === "fixture" && (
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.onlyClasses !== null}
                  onChange={(event) => setClassFilter(event.target.checked ? ["suitable"] : null)}
                />
                <span>nur „geeignet“ zeigen</span>
              </label>
            )}
          </div>
          <p className="explorer-note muted">
            Ausgeblendete Zellen bleiben in der Legende gezählt; die Einschränkung ändert nur, was gezeichnet wird.
          </p>
        </section>

        <section aria-labelledby="view-heading" className="explorer-section">
          <h2 id="view-heading" className="overline">
            Ausschnitt
          </h2>
          <div className="explorer-views">
            <button type="button" className="btn btn-small" onClick={() => setFocus({ kind: "region", nonce: ++nonce.current })}>
              {region.level === "land" ? "Ganzes Land" : region.level === "kreis" ? "Ganzer Landkreis" : "Ganzer Beispieldatensatz"}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setAnnouncement("Link zu diesem Ausschnitt kopiert.");
                } catch {
                  setAnnouncement("Der Link steht in der Adresszeile des Browsers.");
                }
              }}
            >
              Link kopieren
            </button>
          </div>
          <p className="explorer-note muted">
            {view ? (
              <>
                Zoomstufe <span className="tabular-nums">{view.zoom.toFixed(1)}</span> ·{" "}
                {overview ? "Übersicht in Waben" : view.zoom < INTERACTIVE_MIN_ZOOM ? "Zellen als Textur" : "einzelne Zellen anwählbar"}.
                Der Link enthält Gebiet, Ausschnitt und Auswahl.
              </>
            ) : (
              "Der Link dieser Seite enthält Gebiet, Ausschnitt und Auswahl."
            )}
          </p>
        </section>

        <GroupPanel
          ids={group}
          selectedId={selectedId}
          onSelect={selectFromList}
          onRemove={toggleGroup}
          onClear={() => {
            setGroup([]);
            setAnnouncement("Auswahl mehrerer Zellen geleert.");
          }}
        />

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
          inGroup={group.includes(selectedId)}
          onToggleGroup={() => toggleGroup(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {hover && (
        <div className="panel map-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
          {hover.overview ? (
            <>
              <span>{hover.overview.levelM >= 1000 ? `${hover.overview.levelM / 1000}-km-Wabe` : `${hover.overview.levelM}-m-Wabe`}</span>
              <span className="muted"> · </span>
              <span className="tabular-nums">{COUNT.format(hover.overview.n)} Zellen</span>
              <span className="muted"> · am häufigsten </span>
              <span>{VERDICT_LABEL_DE[hover.verdict]}</span>
              <span className="muted tabular-nums"> ({PERCENT.format(hover.overview.share * 100)} %)</span>
            </>
          ) : (
            <>
              <span className="tabular-nums">{hover.id.slice(0, 8)}</span>
              <span className="muted"> · </span>
              <span>{VERDICT_LABEL_DE[hover.verdict]}</span>
              {hover.score != null && <span className="muted tabular-nums"> · {hover.score.toFixed(2)}</span>}
            </>
          )}
        </div>
      )}

      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
