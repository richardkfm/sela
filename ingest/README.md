# `ingest/`

The GDAL + PostGIS SQL pipeline is Phase 2 (`0.2.1`) work, gated on `docs/data/sources.md`
reaching **Confirmed** licence status for each dataset it loads
(`docs/architecture/roadmap-to-first-deployment.md` §2.2, §4.2).

`run.sh` is a Phase 1 placeholder so `docker compose --profile ingest run ingest` builds and
exits cleanly instead of failing, without pretending ingestion exists yet.

Planned steps (roadmap §4.2), each idempotent and individually re-runnable:

1. fetch (kept separate from load, so the pipeline can re-run offline)
2. reproject with GDAL
3. load to PostGIS
4. generate the hex grid (`ST_HexagonGrid`, clipped to the pilot boundary — ADR-0001)
5. sample rasters and intersect vectors onto cells
6. write `criterion_value` rows, each with its `source_id`
