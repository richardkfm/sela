-- Roadmap Step 4 (docs/product/roadmap-pilot-demo.md; docs/domain/decision-memo-habitat.md):
-- nature capital as categories, not a score (scoring-criteria.md §4.3, decision
-- D5 of 2026-09-24). One row per cell and mapped biotope of the LfU
-- Biotopkataster (docs/data/sources.md §2.12): its type, its protection status
-- under § 30 BNatSchG i. V. m. § 18 BbgNatSchAG as the Kataster records it, its
-- FFH habitat type and conservation grade where it has one, and how much of
-- the cell it covers. Written by ingest/real/23_habitat_overlap.sql.
--
-- Like protection_overlap (ADR-0009), every overlap is stored however small;
-- which overlaps are shown is code (lib/scoring/habitat.ts), so a display rule
-- changes without a re-ingest. Region data, not method output: no method_version.

CREATE TABLE habitat_overlap (
  spatial_unit_id  uuid NOT NULL REFERENCES spatial_unit (id) ON DELETE CASCADE,
  -- BBK PK_IDENT: unique biotope id (VERWALT + TK + ID).
  biotope_id       text NOT NULL,
  geometry_kind    text NOT NULL CHECK (geometry_kind IN ('area', 'line', 'point')),
  biotope_code     text NOT NULL,
  biotope_name     text NOT NULL,
  -- BBGNAT: '1' geschützt, '0' kein geschützter Biotop, 'W' Schutz wiederherstellbar, '9' nicht bewertbar, '-1' keine Angaben.
  protection_code  text,
  protection_text  text,
  -- FFHLRT / FFHLRT_T; NULL where the biotope carries no habitat type.
  lrt_code         text,
  lrt_name         text,
  -- FFHGES: overall conservation grade of the habitat type (A, B, C, E, Z, 0, 9).
  lrt_grade        text,
  -- INTEN: mapping intensity (C full, B simple terrestrial, A / A2 aerial imagery).
  mapping_method   text,
  mapped_first     date,
  mapped_last      date,
  -- Share of the cell (area) or length inside it in metres (line); NULL for points.
  share            double precision CHECK (share IS NULL OR (share > 0 AND share <= 1)),
  length_m         double precision CHECK (length_m IS NULL OR length_m > 0),
  source_id        text NOT NULL REFERENCES source (id),
  PRIMARY KEY (spatial_unit_id, biotope_id, geometry_kind),
  CHECK ((geometry_kind = 'area') = (share IS NOT NULL)),
  CHECK ((geometry_kind = 'line') = (length_m IS NOT NULL))
);

COMMENT ON TABLE habitat_overlap IS
  'Roadmap Step 4: mapped biotopes of the LfU Biotopkataster per cell — facts, not a score '
  '(scoring-criteria.md §4.3). Which rows are shown is decided by lib/scoring/habitat.ts.';
