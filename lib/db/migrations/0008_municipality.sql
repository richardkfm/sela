-- Roadmap Step 5 (docs/product/roadmap-pilot-demo.md; mvp.md F1): finding land
-- by *Gemeinde*. The boundaries come from the already-confirmed BKG VG25
-- archive (docs/data/sources.md §2.5), layer `vg25_gem`, the same product and
-- Produktstand as the pilot boundary, cut to the pilot region's AGS. Written
-- by ingest/real/17_municipalities.sh.
--
-- Region data, not method output: no method_version. A cell is placed in the
-- Gemeinde that contains a point on its surface (lib/db/queries/municipalities.ts)
-- — a 100 m cell on a municipal border belongs to one Gemeinde on screen, and
-- the page says which rule placed it.

CREATE TABLE municipality (
  ags           text PRIMARY KEY CHECK (ags ~ '^[0-9]{8}$'),
  pilot_region  text NOT NULL,
  name          text NOT NULL,
  -- VG25 BEZ: "Stadt", "Gemeinde", …
  kind          text NOT NULL,
  geom          geometry(MultiPolygon, 25832) NOT NULL,
  source_id     text NOT NULL REFERENCES source (id)
);

CREATE INDEX municipality_geom_idx ON municipality USING gist (geom);
CREATE INDEX municipality_pilot_region_idx ON municipality (pilot_region);

COMMENT ON TABLE municipality IS
  'Roadmap Step 5 (mvp.md F1): Gemeinde boundaries from BKG VG25 (vg25_gem, CC BY 4.0), for search and '
  'for naming the Gemeinde a cell lies in. Region data; no method_version.';
