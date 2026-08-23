// spatial_unit.id is a gen_random_uuid() default (lib/db/migrations/0002_domain_schema.sql)
// — never deterministic across ingest runs — so tests resolve a real fixture
// unit id from the app's own API rather than hardcoding one. Criterion ids
// ARE deterministic (ingest/fixtures/seed_fixture_definitions.sql's literal
// ids), so those are used directly.

import type { APIRequestContext } from "@playwright/test";

export const KNOWN_CRITERION_ID = "fixture_land_cover_coverage";

export async function getSampleUnitId(request: APIRequestContext, baseURL: string): Promise<string> {
  const response = await request.get(`${baseURL}/api/units?pilotRegion=fixture-region`);
  const collection = await response.json();
  const id = collection.features?.[0]?.id;
  if (!id) {
    throw new Error("no spatial units found for pilot_region=fixture-region — run ingest/run.sh --fixture and pnpm db:materialize first");
  }
  return id;
}
