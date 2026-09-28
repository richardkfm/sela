// Prüfhinweise (decision memo Q1c, Q2d; ADR-0009): which overlaps are named,
// and that every text cites its source and statute and never a permission outcome.

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatShareDe, protectionFlags, type ProtectionOverlap } from "../protection-flags";

function overlap(category: ProtectionOverlap["category"], share: number, name = "Testgebiet"): ProtectionOverlap {
  return { spatialUnitId: "u", category, areaCode: `${category}-1`, name, share, sourceId: "lfu-bb-schutzgebiete" };
}

test("FFH, SPA and LSG are named as conditions, with the duty their statute sets", () => {
  const flags = protectionFlags([overlap("ffh", 0.4), overlap("spa", 1), overlap("lsg", 0.2)], 0);
  assert.deepEqual(
    flags.map((f) => [f.category, f.kind, f.legalRef]),
    [
      ["spa", "natura2000_assessment", "§ 34 BNatSchG"],
      ["ffh", "natura2000_assessment", "§ 34 BNatSchG"],
      ["lsg", "lsg_ordinance", "§ 26 BNatSchG"],
    ],
  );
});

test("the texts are grammatical German: dative after \"im\"", () => {
  const [spa] = protectionFlags([overlap("spa", 0.8, "Schorfheide-Chorin")], 0);
  assert.match(spa!.textDe, /im Europäischen Vogelschutzgebiet „Schorfheide-Chorin“/);
});

test("an overlap under 1 % of the cell is not shown", () => {
  assert.equal(protectionFlags([overlap("ffh", 0.009)], 0).length, 0);
  assert.equal(protectionFlags([overlap("ffh", 0.01)], 0).length, 1);
});

test("a Naturschutzgebiet is named with its share only while the cell is not excluded", () => {
  const partial = protectionFlags([overlap("nsg", 0.3)], 0.3);
  assert.equal(partial.length, 1);
  assert.equal(partial[0]!.kind, "partial_strict_protection");
  assert.match(partial[0]!.textDe, /30 % der Fläche/);
  assert.equal(protectionFlags([overlap("nsg", 0.3), overlap("natp", 0.25)], 0.5).length, 0, "excluded: the exclusion says it");
});

test("Biosphärenreservate are stored but not flagged (§ 25 BNatSchG not read at source)", () => {
  assert.equal(protectionFlags([overlap("br", 1)], 0).length, 0);
});

test("every text names the LfU overview data and never a permission outcome", () => {
  const flags = protectionFlags([overlap("ffh", 0.5), overlap("spa", 0.5), overlap("lsg", 0.5), overlap("nsg", 0.2)], 0.2);
  for (const flag of flags) {
    assert.match(flag.textDe, /Übersichtsdaten des LfU/);
    assert.doesNotMatch(flag.textDe, /genehmig|zulässig ist hier|unzulässig|verboten ist hier/i);
  }
});

test("shares are whole percent, and a near-whole cell does not read as all of it", () => {
  assert.equal(formatShareDe(0.254), "25 %");
  assert.equal(formatShareDe(1), "100 %");
  assert.equal(formatShareDe(0.996), "fast 100 %");
});
