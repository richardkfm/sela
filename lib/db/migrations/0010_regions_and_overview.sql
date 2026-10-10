-- ADR-0012: regions as a hierarchy (Land › Landkreis), cells stamped with
-- their Gemeinde's AGS, an overview pyramid for the map and per-region counts.
--
-- Until now a "pilot region" was a free-text key on spatial_unit and a
-- TypeScript registry. With two whole Länder (docs/product/roadmap-planning-
-- tool.md) a region is a row: it knows its kind, its parent, its boundary and
-- which cells are its own. A Landkreis seen as a sector of a Land's grid is a
-- prefix test on the cells' AGS, not a second grid.
--
-- Additive and backfilling: existing installs keep their Uckermark grid; this
-- migration registers it as a Landkreis of Brandenburg and stamps its cells
-- from the Gemeinden already loaded (migration 0008). The overview and the
-- counts are written by the materialiser (ingest/08_materialize_overview.sql);
-- until it runs, the explorer says so below the cell zoom.

-- ---------------------------------------------------------------------------
-- region: Land, Landkreis or the synthetic fixture. `geom` is the VG25
-- boundary (CC BY 4.0), null for the fixture and until the next ingest for a
-- region registered by this migration.
-- ---------------------------------------------------------------------------
CREATE TABLE region (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('land', 'kreis', 'fixture')),
  -- Amtlicher Gemeindeschlüssel: 2 digits for a Land, 5 for a Kreis, null for the fixture.
  ags           text UNIQUE CHECK (ags ~ '^[0-9]{2}$' OR ags ~ '^[0-9]{5}$'),
  name          text NOT NULL,
  -- VG25 BEZ: "Land", "Freistaat", "Landkreis", "Kreisfreie Stadt".
  bez           text,
  parent_id     text REFERENCES region (id),
  geom          geometry(MultiPolygon, 25832),
  source_id     text REFERENCES source (id),
  -- Cells this region shows: its own grid's, or — for a Landkreis of a Land grid — those stamped
  -- with its AGS prefix. Written by the materialiser (and by this migration for existing data),
  -- so listing the regions never counts a million rows.
  unit_count    integer NOT NULL DEFAULT 0 CHECK (unit_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'fixture') = (ags IS NULL)),
  CHECK (kind <> 'kreis' OR parent_id IS NOT NULL)
);

CREATE INDEX region_geom_idx ON region USING gist (geom);
CREATE INDEX region_parent_idx ON region (parent_id);

COMMENT ON TABLE region IS
  'ADR-0012: a Land, a Landkreis or the fixture. A region with its own cells is a grid region '
  '(spatial_unit.pilot_region = region.id); a Landkreis of a Land grid is a view over the parent''s cells '
  'by AGS prefix (spatial_unit.ags).';

-- ---------------------------------------------------------------------------
-- spatial_unit.ags: the Gemeinde containing a point on the cell's surface,
-- stamped at ingest (ingest/real/24_stamp_ags.sql). Land = left(ags, 2),
-- Kreis = left(ags, 5). Null for the fixture and for a cell outside every
-- loaded Gemeinde.
-- ---------------------------------------------------------------------------
ALTER TABLE spatial_unit ADD COLUMN ags text CHECK (ags ~ '^[0-9]{8}$');
CREATE INDEX spatial_unit_kreis_idx ON spatial_unit (pilot_region, left(ags, 5));
CREATE INDEX spatial_unit_ags_idx ON spatial_unit (pilot_region, ags);

COMMENT ON COLUMN spatial_unit.ags IS
  'AGS of the Gemeinde containing ST_PointOnSurface(geom), stamped at ingest (ADR-0012). '
  'Kreis = left(ags, 5), Land = left(ags, 2).';

-- ---------------------------------------------------------------------------
-- unit_overview: the display pyramid below the cell zoom (ADR-0012). One row
-- per region, level and hexagon: how many cells it holds, how many per class
-- and technology, and the most frequent class per technology with its share.
-- Derived from the cells by ingest/08_materialize_overview.sql; never an
-- analysis input — no number is computed on these.
-- ---------------------------------------------------------------------------
CREATE TABLE unit_overview (
  region_id       text NOT NULL REFERENCES region (id) ON DELETE CASCADE,
  level_m         integer NOT NULL CHECK (level_m > 0),
  i               integer NOT NULL,
  j               integer NOT NULL,
  geom            geometry(Polygon, 25832) NOT NULL,
  geom_3857       geometry(Polygon, 3857) GENERATED ALWAYS AS (ST_Transform(geom, 3857)) STORED,
  n_cells         integer NOT NULL CHECK (n_cells > 0),
  -- {"pv": {"unrestricted": 61, "excluded": 4, …}, "agripv": {…}, "wind": {…}}; cells without a
  -- verdict row count as "unscored".
  counts          jsonb NOT NULL,
  d_pv            text NOT NULL,
  d_agripv        text NOT NULL,
  d_wind          text NOT NULL,
  s_pv            real NOT NULL CHECK (s_pv > 0 AND s_pv <= 1),
  s_agripv        real NOT NULL CHECK (s_agripv > 0 AND s_agripv <= 1),
  s_wind          real NOT NULL CHECK (s_wind > 0 AND s_wind <= 1),
  n_flag_pv       integer NOT NULL DEFAULT 0,
  n_flag_agripv   integer NOT NULL DEFAULT 0,
  method_version  text NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region_id, level_m, i, j, method_version)
);

CREATE INDEX unit_overview_tile_idx ON unit_overview USING gist (geom_3857);

COMMENT ON TABLE unit_overview IS
  'ADR-0012: aggregated hexagons (1 km, 5 km) for the explorer below the cell zoom — counts per class '
  'and the most frequent class per technology (d_*) with its share (s_*). Display only.';

-- ---------------------------------------------------------------------------
-- region_verdict_count: the legend's numbers per region and technology,
-- written at materialisation so a Land does not count a million rows per
-- page load. "unscored" counts the cells without a verdict row.
-- ---------------------------------------------------------------------------
CREATE TABLE region_verdict_count (
  region_id       text NOT NULL REFERENCES region (id) ON DELETE CASCADE,
  technology      text NOT NULL CHECK (technology IN ('pv', 'agripv', 'wind')),
  verdict         text NOT NULL,
  n               integer NOT NULL CHECK (n >= 0),
  method_version  text NOT NULL,
  PRIMARY KEY (region_id, technology, verdict, method_version)
);

-- ---------------------------------------------------------------------------
-- region_source: the sources whose data a region's cells carry — what the
-- map's attribution control credits (docs/data/sources.md §7 condition 4).
-- ---------------------------------------------------------------------------
CREATE TABLE region_source (
  region_id   text NOT NULL REFERENCES region (id) ON DELETE CASCADE,
  source_id   text NOT NULL REFERENCES source (id),
  PRIMARY KEY (region_id, source_id)
);

-- ---------------------------------------------------------------------------
-- Backfill for installs that already hold data. Every grid region present
-- gets a row; the two ids sela has shipped are named, anything else is
-- registered as a fixture (claiming "real" for data nobody registered would
-- be the worse mistake — lib/pilot-region.ts says the same).
-- ---------------------------------------------------------------------------
INSERT INTO region (id, kind, ags, name, bez, parent_id, source_id)
SELECT 'brandenburg-12', 'land', '12', 'Brandenburg', 'Land', NULL,
       (SELECT id FROM source WHERE id = 'bkg-vg25')
WHERE EXISTS (SELECT 1 FROM spatial_unit WHERE pilot_region = 'uckermark-12073');

INSERT INTO region (id, kind, ags, name, bez, parent_id, source_id)
SELECT 'uckermark-12073', 'kreis', '12073', 'Uckermark', 'Landkreis', 'brandenburg-12',
       (SELECT id FROM source WHERE id = 'bkg-vg25')
WHERE EXISTS (SELECT 1 FROM spatial_unit WHERE pilot_region = 'uckermark-12073');

INSERT INTO region (id, kind, ags, name, bez)
SELECT DISTINCT pilot_region, 'fixture', NULL,
       CASE WHEN pilot_region = 'fixture-region' THEN 'Beispieldatensatz' ELSE pilot_region END,
       NULL
FROM spatial_unit
WHERE pilot_region NOT IN (SELECT id FROM region);

-- The Uckermark's cells, stamped from the Gemeinden migration 0008 loaded.
UPDATE spatial_unit su
SET ags = m.ags
FROM municipality m
WHERE su.ags IS NULL
  AND m.pilot_region = su.pilot_region
  AND ST_Contains(m.geom, ST_PointOnSurface(su.geom));

UPDATE region r SET unit_count = c.n
FROM (SELECT pilot_region, count(*) AS n FROM spatial_unit GROUP BY pilot_region) c
WHERE c.pilot_region = r.id;
