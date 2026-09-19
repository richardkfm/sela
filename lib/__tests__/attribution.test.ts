import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHANGE_NOTICE_DE,
  UNCITABLE_ATTRIBUTION,
  isCitable,
  partitionByCitability,
  renderAttribution,
} from "../attribution";
import type { SourceRow } from "../db/queries/criteria";

function source(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: "bkg-clc5",
    dataset: "CORINE Land Cover 5 ha (CLC5), Stand 2018",
    publisher: "Bundesamt für Kartographie und Geodäsie (BKG)",
    version: null,
    retrievedAt: "2026-09-19",
    licence: "dl-de/by-2-0",
    redistributable: true,
    url: null,
    attribution: "© GeoBasis-DE / BKG <Jahr> dl-de/by-2-0",
    attributionUrl: "https://www.govdata.de/dl-de/by-2-0",
    changeNoticeRequired: true,
    ...overrides,
  };
}

test("resolves <Jahr> from the source's own retrieval year, not today", () => {
  // The licences ask for the "Jahr des letzten Datenbezugs". For a pinned
  // artefact that is when sela fetched it; it must not drift with the clock.
  assert.equal(
    renderAttribution(source()),
    `© GeoBasis-DE / BKG 2026 dl-de/by-2-0 ${CHANGE_NOTICE_DE}`,
  );
});

test("falls back to the current year only when no retrieval date exists", () => {
  const notice = renderAttribution(source({ retrievedAt: null, changeNoticeRequired: false }), {
    fallbackYear: 2031,
  });
  assert.equal(notice, "© GeoBasis-DE / BKG 2031 dl-de/by-2-0");
});

test("appends the Veränderungshinweis only where the licence demands it", () => {
  assert.ok(renderAttribution(source()).endsWith(CHANGE_NOTICE_DE));
  assert.ok(!renderAttribution(source({ changeNoticeRequired: false })).includes(CHANGE_NOTICE_DE));
});

test("replaces every occurrence of the placeholder", () => {
  const notice = renderAttribution(
    source({ attribution: "© BKG <Jahr> CC BY 4.0, Stand <Jahr>", changeNoticeRequired: false }),
  );
  assert.equal(notice, "© BKG 2026 CC BY 4.0, Stand 2026");
});

test("VG25's notice differs from CLC5's although both are BKG", () => {
  // The near-miss that motivated storing the notice per source rather than
  // deriving it from the licence family — see docs/data/sources.md §2.5.
  const vg25 = renderAttribution(
    source({
      id: "bkg-vg25",
      licence: "CC BY 4.0",
      attribution: "© BKG <Jahr> CC BY 4.0",
    }),
  );
  assert.ok(vg25.startsWith("© BKG 2026"));
  assert.ok(!vg25.includes("GeoBasis-DE"));
});

test("a source with no recorded notice is not citable", () => {
  assert.equal(isCitable(source({ attribution: UNCITABLE_ATTRIBUTION })), false);
  assert.equal(isCitable(source({ attribution: "   " })), false);
  assert.equal(isCitable(source()), true);
});

test("a real notice mentioning citability is still citable", () => {
  // Guards the marker being matched verbatim rather than by substring.
  const odd = source({ attribution: `Quelle X — ${UNCITABLE_ATTRIBUTION} laut Altbestand` });
  assert.equal(isCitable(odd), true);
});

test("partitionByCitability keeps uncitable sources visible rather than dropping them", () => {
  const { citable, uncitable } = partitionByCitability([
    source(),
    source({ id: "legacy", attribution: UNCITABLE_ATTRIBUTION }),
  ]);
  assert.deepEqual(citable.map((s) => s.id), ["bkg-clc5"]);
  assert.deepEqual(uncitable.map((s) => s.id), ["legacy"]);
});
