-- ADR-0007: units are served to the map as vector tiles (ST_AsMVT), because a
-- real pilot region is ~117 000 cells — far too many for one GeoJSON response.
--
-- Tiles are cut in Web Mercator (EPSG:3857). Transforming 30 000 polygons from
-- the storage CRS (EPSG:25832, ADR-0001) on every tile request would make the
-- transform the dominant cost, so the Mercator geometry is stored once, as a
-- generated column: it can never drift from `geom`, because it is not written
-- by anyone — PostGIS derives it. `geom` stays the only geometry analysis reads.

ALTER TABLE spatial_unit
  ADD COLUMN geom_3857 geometry(Polygon, 3857) GENERATED ALWAYS AS (ST_Transform(geom, 3857)) STORED;

CREATE INDEX spatial_unit_geom_3857_idx ON spatial_unit USING gist (geom_3857);

COMMENT ON COLUMN spatial_unit.geom_3857 IS
  'Display-only Web Mercator copy of geom for vector tiles (ADR-0007). Derived, never written; never used for analysis.';
