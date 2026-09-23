"use client";

// The 3D parcel preview's panel and state (ADR-0006). It answers one
// question — *how big is this, here?* — and is careful to answer only that:
// the models are true to a stated, illustrative scale; the rings carry their
// legal source and their limits; what the preview does not know (buildings,
// woodland, wind direction, visibility) is said in words beside the view
// rather than left for the picture to imply.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { TechnologySwitch } from "@/components/TechnologySwitch";
import { TECHNOLOGY_LABEL_DE, VERDICT_LABEL_DE } from "@/lib/map/verdict-style";
import {
  AGRIPV_LAYOUT,
  PV_LAYOUT,
  REFERENCE_TURBINE,
  SETBACK_RINGS,
  TURBINE_SLIDER_BOUNDS,
  totalHeightM,
  type ReferenceDimension,
  type RowLayout,
} from "@/lib/preview/reference-geometry";
import type { SuitabilityVerdict, Technology } from "@/lib/scoring/types";
import type { PreviewData, SceneTechnology, ViewRequest } from "./Scene";

// MapLibre and deck.gl touch `window` and WebGL on import; the scene is client-only.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="map-canvas preview-loading" />,
});

const OPTIONS: readonly SceneTechnology[] = ["status_quo", "pv", "agripv", "wind"];
const BEARINGS = [
  { deg: 0, label: "N", long: "Norden" },
  { deg: 90, label: "O", long: "Osten" },
  { deg: 180, label: "S", long: "Süden" },
  { deg: 270, label: "W", long: "Westen" },
] as const;

const NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const formatDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE");
const metres = (value: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} m`;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function Preview3D({
  unitId,
  initialTechnology,
  verdicts,
  terrainNotice,
}: {
  unitId: string;
  initialTechnology: SceneTechnology;
  verdicts: SuitabilityVerdict[];
  terrainNotice: string | null;
}) {
  const [technology, setTechnology] = useState<SceneTechnology>(initialTechnology);
  const [hub, setHub] = useState<number>(REFERENCE_TURBINE.hubHeight.value);
  const [rotor, setRotor] = useState<number>(REFERENCE_TURBINE.rotorDiameter.value);
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewRequest | null>(null);
  const [bearing, setBearing] = useState<number>(180);
  const [terrain, setTerrain] = useState<"loading" | "ready" | "absent">("loading");
  const reducedMotion = usePrefersReducedMotion();
  const [spinning, setSpinning] = useState(false);
  const nonce = useRef(0);
  const firstLoad = useRef(true);

  // Motion is opt-in when the reader has asked for less of it (design-language.md §9).
  useEffect(() => setSpinning(!reducedMotion), [reducedMotion]);

  // Geometry comes from the server; slider moves are debounced so dragging doesn't flood PostGIS.
  useEffect(() => {
    const controller = new AbortController();
    const apiTechnology: Technology = technology === "status_quo" ? "pv" : technology;
    const timer = window.setTimeout(() => {
      fetch(`/api/unit/${unitId}/preview?technology=${apiTechnology}&hub=${hub}&rotor=${rotor}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
        .then((next: PreviewData) => {
          setData(next);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) setError(String(e));
        });
    }, firstLoad.current ? 0 : 150);
    firstLoad.current = false;
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [unitId, technology, hub, rotor]);

  const changeTechnology = useCallback((next: SceneTechnology) => {
    setTechnology(next);
    setView({ kind: "close", nonce: ++nonce.current });
    const url = new URL(window.location.href);
    url.searchParams.set("technology", next);
    window.history.replaceState(null, "", url);
  }, []);

  const verdict = technology === "status_quo" ? null : verdicts.find((v) => v.technology === technology);
  const total = totalHeightM(hub, rotor);
  const rings = technology === "wind" ? (data?.rings ?? []) : [];

  return (
    <div className="map-stage">
      <Scene
        data={data}
        technology={technology}
        spinning={spinning && technology === "wind"}
        view={view}
        onStatus={(status) => setTerrain(status.terrain)}
      />

      {view?.kind === "eye" && technology === "wind" && (
        <p className="panel preview-caption" aria-live="polite">
          Blick von {BEARINGS.find((b) => b.deg === view.bearingDeg)?.long},{" "}
          {metres(rings.find((r) => r.id === view.ringId)?.radiusM ?? 0)} vom Mastfuß, Augenhöhe 1,7 m
        </p>
      )}

      <aside className="panel explorer-side preview-side" aria-label="3D-Vorschau: Einstellungen und Quellen">
        <header className="explorer-masthead">
          <Link href="/" className="back-link">
            ← Zur Karte
          </Link>
          <h1>
            3D-Vorschau · Fläche <span className="tabular-nums">{unitId.slice(0, 8)}</span>
          </h1>
          <p className="muted">Wie groß wäre eine Anlage hier – im wahren Maßstab, auf dem Gelände.</p>
        </header>

        <IllustrativeBanner compact />

        <section className="explorer-section" aria-labelledby="scenario-heading">
          <h2 id="scenario-heading" className="overline">
            Szenario
          </h2>
          <TechnologySwitch value={technology} onChange={changeTechnology} options={OPTIONS} label="Szenario" />
          {verdict && (
            <p className="explorer-note">
              Eignung für {TECHNOLOGY_LABEL_DE[verdict.technology]}: <strong>{VERDICT_LABEL_DE[verdict.verdict]}</strong>
              {verdict.score !== null && <span className="tabular-nums muted"> · {verdict.score.toFixed(2)}</span>}{" "}
              <span className="muted">(illustrativ)</span> · <Link href={`/unit/${unitId}`}>Begründung</Link>
            </p>
          )}
          {technology === "status_quo" && (
            <p className="explorer-note">
              Die Fläche wie heute, ohne Anlage. Was hier erhalten oder renaturiert würde, ist kein Bauwerk – das zeigt
              der Szenarienvergleich.
            </p>
          )}
        </section>

        {technology === "wind" && (
          <>
            <section className="explorer-section" aria-labelledby="turbine-heading">
              <h2 id="turbine-heading" className="overline">
                Referenzanlage <span className="tag">illustrativ</span>
              </h2>
              <Slider
                id="hub"
                label={REFERENCE_TURBINE.hubHeight.labelDe}
                value={hub}
                bounds={TURBINE_SLIDER_BOUNDS.hubHeight}
                onChange={setHub}
              />
              <Slider
                id="rotor"
                label={REFERENCE_TURBINE.rotorDiameter.labelDe}
                value={rotor}
                bounds={TURBINE_SLIDER_BOUNDS.rotorDiameter}
                onChange={setRotor}
              />
              <dl className="dl-grid">
                <dt>Gesamthöhe (Nabe + Rotorradius)</dt>
                <dd>{metres(total)}</dd>
                {data && (
                  <>
                    <dt>Breite der Fläche</dt>
                    <dd>{metres(data.unit.widthM)}</dd>
                  </>
                )}
              </dl>
              {data && rotor > data.unit.widthM * 0.8 && (
                <p className="explorer-note muted">
                  Der Rotorkreis ist fast so breit wie die ganze Fläche oder breiter: Eine Windenergieanlage wirkt weit
                  über die Einheit hinaus, auf der sie steht.
                </p>
              )}
              <label className="toggle">
                <input type="checkbox" checked={spinning} onChange={(e) => setSpinning(e.target.checked)} />
                <span>
                  Rotor bewegen <span className="muted">– zur Anschauung; Drehzahl frei gewählt</span>
                </span>
              </label>
            </section>

            <section className="explorer-section" aria-labelledby="rings-heading">
              <h2 id="rings-heading" className="overline">
                Abstände um den Mastfuß
              </h2>
              {data?.jurisdiction?.asIfIn && (
                <p className="explorer-note muted">
                  Beispieldatensatz: Die Ringe sind so gezeichnet, als läge die Fläche im {data.jurisdiction.asIfIn}.
                </p>
              )}
              {rings.length === 0 && data && (
                <p className="explorer-note muted">Für diese Region sind keine Abstandsregeln hinterlegt.</p>
              )}
              <ul className="ring-list">
                {rings.map((ring) => {
                  const rule = SETBACK_RINGS.find((r) => r.id === ring.id);
                  if (!rule) return null;
                  return (
                    <li key={ring.id}>
                      <div className="ring-head">
                        <span aria-hidden className={`ring-mark${ring.id === "baugb_249_10" ? " ring-mark-dashed" : ""}`} />
                        <strong>{rule.shortLabelDe}</strong>
                        <span className="tabular-nums">{metres(ring.radiusM)}</span>
                        <a href={rule.sourceUrl} target="_blank" rel="noreferrer">
                          {rule.citationDe}
                        </a>
                      </div>
                      <details>
                        <summary>Wortlaut und Grenzen</summary>
                        <blockquote>„{rule.quoteDe}“</blockquote>
                        <p>
                          <strong>Gemessen:</strong> {rule.measuredFromDe}. <strong>Grenzen:</strong> {rule.limitsDe}
                        </p>
                        <p>
                          {rule.verification === "official_text"
                            ? `Wortlaut am amtlichen Text geprüft (${formatDate(rule.verifiedOn)}).`
                            : `Wortlaut aus zweiter Hand (${formatDate(rule.verifiedOn)}) – der amtliche Text war nicht direkt abrufbar und ist noch zu prüfen.`}
                        </p>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="explorer-section" aria-labelledby="eye-heading">
              <h2 id="eye-heading" className="overline">
                Blick aus Augenhöhe
              </h2>
              <div className="segmented" role="group" aria-label="Blickrichtung: Standort des Betrachters">
                {BEARINGS.map((b) => (
                  <button
                    key={b.deg}
                    type="button"
                    aria-pressed={bearing === b.deg}
                    aria-label={`von ${b.long}`}
                    onClick={() => setBearing(b.deg)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="explorer-views">
                {rings.map((ring) => {
                  const rule = SETBACK_RINGS.find((r) => r.id === ring.id);
                  return (
                    <button
                      key={ring.id}
                      type="button"
                      className="btn btn-small"
                      onClick={() => setView({ kind: "eye", ringId: ring.id, bearingDeg: bearing, nonce: ++nonce.current })}
                    >
                      aus {metres(ring.radiusM)}
                      <span className="visually-hidden"> ({rule?.shortLabelDe}, {rule?.citationDe})</span>
                    </button>
                  );
                })}
              </div>
              <p className="explorer-note muted">
                Der Rotor ist zum Betrachter gedreht – so erscheint er am größten; die Windrichtung ist nicht
                modelliert. Nur Gelände und Anlage: Gebäude, Wald und Hecken fehlen im Modell und verdecken in Wirklichkeit oft die
                Sicht. Das ist keine Sichtbarkeitsanalyse.
              </p>
            </section>
          </>
        )}

        {(technology === "pv" || technology === "agripv") && (
          <section className="explorer-section" aria-labelledby="layout-heading">
            <h2 id="layout-heading" className="overline">
              Referenz-Belegung <span className="tag">illustrativ</span>
            </h2>
            <LayoutTable layout={technology === "agripv" ? AGRIPV_LAYOUT : PV_LAYOUT} />
            {data && (
              <dl className="dl-grid">
                <dt>Modulreihen auf der Fläche</dt>
                <dd>{data.rows.length}</dd>
                <dt>Flächengröße</dt>
                <dd>{NUMBER.format(data.unit.areaHa)} ha</dd>
              </dl>
            )}
            <p className="explorer-note muted">
              Reihen Ost–West, Module nach Süden geneigt, mit Randabstand. Eine mögliche Belegung, keine Planung und
              keine Ertragsaussage.
            </p>
          </section>
        )}

        <section className="explorer-section" aria-labelledby="camera-heading">
          <h2 id="camera-heading" className="overline">
            Ansicht
          </h2>
          <div className="explorer-views">
            <button type="button" className="btn btn-small" onClick={() => setView({ kind: "overview", nonce: ++nonce.current })}>
              Überblick
            </button>
            <button type="button" className="btn btn-small" onClick={() => setView({ kind: "close", nonce: ++nonce.current })}>
              Nah heran
            </button>
          </div>
          <p className="explorer-note muted">
            Tastatur: Karte anklicken oder mit Tab fokussieren, dann Pfeiltasten verschieben, Umschalt + Pfeile drehen und
            neigen, + / − zoomen.
          </p>
        </section>

        <section className="explorer-section preview-provenance" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="overline">
            Quellen
          </h2>
          <ul>
            <li>
              <strong>Gelände:</strong>{" "}
              {terrain === "absent" || !terrainNotice ? (
                "nicht geladen – flache Darstellung"
              ) : (
                <>
                  basemap.de 3D Gelände (DGM5), {terrainNotice}. Beta-Dienst des BKG, Nutzung laut Lizenz „zu
                  Testzwecken“. Außerhalb Deutschlands kein Gelände.
                </>
              )}
            </li>
            <li>
              <strong>Abstände:</strong> § 249 Abs. 10 BauGB, § 1 BbgWEAAbG – Wortlaut und Prüfstand bei den Ringen oben.
            </li>
            <li>
              <strong>Modelle:</strong> maßstäblich, aber mit illustrativen Maßen; keine Herstellerangaben.
            </li>
          </ul>
          <Link className="btn btn-primary" href={`/unit/${unitId}/compare`}>
            Szenarien vergleichen →
          </Link>
        </section>

        {error && (
          <p role="alert" className="explorer-note">
            Die Vorschau konnte nicht geladen werden ({error}).
          </p>
        )}
      </aside>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  bounds,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-row">
      <label htmlFor={`slider-${id}`}>{label}</label>
      <output htmlFor={`slider-${id}`} className="tabular-nums">
        {metres(value)}
      </output>
      <input
        id={`slider-${id}`}
        className="slider"
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function LayoutTable({ layout }: { layout: RowLayout }) {
  const dims: ReferenceDimension[] = [layout.rowPitch, layout.tableDepth, layout.tilt, layout.lowerEdge, layout.inset];
  return (
    <dl className="dl-grid">
      {dims.map((d) => (
        <div key={d.id} style={{ display: "contents" }}>
          <dt>{d.labelDe}</dt>
          <dd>
            {NUMBER.format(d.value)}
            {d.unit === "°" ? "°" : ` ${d.unit}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}
