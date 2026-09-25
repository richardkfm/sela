-- The real datasets sela has actually fetched, with the exact
-- Quellenvermerk each publisher demands (docs/data/sources.md §3).
--
-- Idempotent: re-running updates the rows rather than failing, because a
-- publisher revising its required notice is a thing that happens and must be
-- correctable by re-running the seed, not by hand-editing a database.
--
-- `<Jahr>` is left as a placeholder and resolved at render time from
-- retrieved_at (lib/attribution.ts) — every licence here asks for the year of
-- last data retrieval, which for a pinned artefact is when sela fetched it and
-- does not change because the calendar did.
--
-- NOTE none of these rows makes anything publishable on its own. They satisfy
-- docs/data/sources.md §7 condition 4 (the notice exists and renders). Since
-- 2026-09-23 the Uckermark ingest (ingest/real/) writes criterion_value rows
-- that cite them.

INSERT INTO source (
  id, dataset, publisher, version, retrieved_at, licence, redistributable, url,
  attribution, attribution_url, change_notice_required
) VALUES
  (
    'bkg-clc5',
    'CORINE Land Cover 5 ha (CLC5), Stand 2018',
    'Bundesamt für Kartographie und Geodäsie (BKG)',
    'CLC5 2018, abgeleitet aus LBM-DE2018 (Neubearbeitung 2021)',
    DATE '2026-09-19',
    'dl-de/by-2-0',
    true,
    'https://daten.gdz.bkg.bund.de/produkte/dlm/clc5_2018/aktuell/clc5_2018.utm32s.shape.zip',
    -- The archive's own quellenvermerk_datenlizenz_deutschland.txt gives
    -- "© GeoBasis-DE / BKG <Jahr>"; BKG's catalogue record appends the licence
    -- label. Carrying both satisfies either reading — see sources.md §3.
    '© GeoBasis-DE / BKG <Jahr> dl-de/by-2-0',
    'https://www.govdata.de/dl-de/by-2-0',
    true
  ),
  (
    'dwd-cdc-radiation',
    'Gridded annual sum of incoming shortwave radiation (global radiation) on the horizontal plain for Germany, Version V003',
    'Deutscher Wetterdienst, Climate Data Center (CDC)',
    'V003, Jahresraster 1991–2025',
    DATE '2026-09-19',
    'CC BY 4.0',
    true,
    'https://opendata.dwd.de/climate_environment/CDC/grids_germany/annual/radiation_global/',
    -- §7 DWD-Gesetz asks for the source note at the information used; the
    -- dataset's own citation lives in `dataset` above rather than being
    -- crammed into a footer line.
    'Quelle: Deutscher Wetterdienst',
    'https://www.dwd.de',
    true
  ),
  (
    'bkg-vg25',
    'Verwaltungsgebiete 1:25 000 (VG25), Produktstand 31.12.2025',
    'Bundesamt für Kartographie und Geodäsie (BKG)',
    'VG25, Produktstand 2025-12-31',
    DATE '2026-09-19',
    'CC BY 4.0',
    true,
    'https://daten.gdz.bkg.bund.de/produkte/vg/vg25_ebenen/aktuell/vg25.utm32s.gpkg.zip',
    -- Note: "© BKG", WITHOUT the "GeoBasis-DE /" prefix CLC5 uses, and CC BY
    -- 4.0 rather than dl-de/by-2-0. Same agency, same host, different notice.
    '© BKG <Jahr> CC BY 4.0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg25.pdf',
    'https://creativecommons.org/licenses/by/4.0',
    true
  ),
  (
    'bkg-dgm200',
    'Digitales Geländemodell Gitterweite 200 m (DGM200), Stand 31.12.2019',
    'Bundesamt für Kartographie und Geodäsie (BKG)',
    'DGM200, abgeleitet aus DGM5; Brandenburg: Ausgangsdaten 2009–2017',
    DATE '2026-09-23',
    'dl-de/by-2-0',
    true,
    'https://daten.gdz.bkg.bund.de/produkte/dgm/dgm200/aktuell/dgm200.utm32s.geotiff.zip',
    -- From dgm200.pdf §"Nutzungsbestimmungen und Quellenvermerk" inside the
    -- archive (Stand 17.03.2021), which names dl-de/by-2-0 — the archive also
    -- ships an older geonutzv.pdf (2017); the dated documentation governs.
    -- A slope derived from the DEM is an alteration; lib/attribution.ts appends
    -- the change notice (change_notice_required = true).
    '© GeoBasis-DE / BKG <Jahr> dl-de/by-2-0',
    'https://www.bkg.bund.de',
    true
  ),
  (
    'lfu-bb-schutzgebiete',
    'Schutzgebiete in Brandenburg (WFS-LFU-SCHUTZG): NSG, Nationalpark, FFH, SPA, LSG, Biosphärenreservat',
    'Landesamt für Umwelt Brandenburg (LfU); Dienst: LGB',
    'WFS 2.0.0, abgerufen 2026-09-23; Digitalisierung 1:10 000, nicht rechtsverbindlich',
    DATE '2026-09-23',
    'dl-de/by-2-0',
    true,
    'https://inspire.brandenburg.de/services/schutzg_wfs',
    -- The service's own AccessConstraints: dl-de/by-2-0, "Als Bezeichnung des
    -- Bereitstellers ist „© Landesamt für Umwelt Brandenburg" anzugeben."
    '© Landesamt für Umwelt Brandenburg dl-de/by-2-0',
    'https://www.govdata.de/dl-de/by-2-0',
    true
  ),
  (
    'lbgr-bb-moorbodenkarte',
    'Moorbodenkarte Brandenburg (WFS-MBK): Bodentypen 2021, Kohlenstoffvorrat 2021',
    'Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg (LBGR)',
    'WFS 2.0.0, abgerufen 2026-09-24; Metadaten überarbeitet 2023-07-18; modellierter Zustand 2021 aus einem 10-m-Raster',
    DATE '2026-09-24',
    'dl-de/by-2-0',
    true,
    'https://inspire.brandenburg.de/services/moorkarte_wfs',
    -- The service's own AccessConstraints: dl-de/by-2-0, "Als Bezeichnung des
    -- Bereitstellers ist „© Landesamt für Bergbau, Geologie und Rohstoffe
    -- Brandenburg" anzugeben"; the metadata record's example adds "(LBGR)".
    '© Landesamt für Bergbau, Geologie und Rohstoffe Brandenburg (LBGR) dl-de/by-2-0',
    'https://www.govdata.de/dl-de/by-2-0',
    true
  ),
  (
    'lfu-bb-wasserhaushalt',
    'Wasserhaushaltsgrößen für das Land Brandenburg auf Elementarflächenbasis, Reihe 1991–2020 (ArcEGMO-PSCN)',
    'Landesamt für Umwelt Brandenburg (LfU); Datenhaltung: LGB',
    'wh_efl20_pscn, Stand der Daten 10.03.2023, Dokumentation 27.06.2025; Einsatzmaßstab ≤ 1:10 000',
    DATE '2026-09-24',
    'dl-de/by-2-0',
    true,
    'https://data.geobasis-bb.de/geofachdaten/Wasser/Wasserhaushalt/arcegmo_wh_91-20.zip',
    -- The documentation (§5) asks for "Erlaubnisvermerk sowie Quelle und Stand
    -- der Daten", so the data date is part of the notice.
    'Landesamt für Umwelt Brandenburg, Wasserhaushaltsgrößen 1991–2020 (ArcEGMO), Stand 10.03.2023, dl-de/by-2-0',
    'https://www.govdata.de/dl-de/by-2-0',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  dataset                = EXCLUDED.dataset,
  publisher              = EXCLUDED.publisher,
  version                = EXCLUDED.version,
  retrieved_at           = EXCLUDED.retrieved_at,
  licence                = EXCLUDED.licence,
  redistributable        = EXCLUDED.redistributable,
  url                    = EXCLUDED.url,
  attribution            = EXCLUDED.attribution,
  attribution_url        = EXCLUDED.attribution_url,
  change_notice_required = EXCLUDED.change_notice_required;
