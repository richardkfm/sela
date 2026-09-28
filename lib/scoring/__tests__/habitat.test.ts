import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HABITAT_CAVEAT_DE, habitatFacts, habitatSummaryDe, summariseHabitat, type HabitatOverlap } from "../habitat";

function overlap(partial: Partial<HabitatOverlap>): HabitatOverlap {
  return {
    spatialUnitId: "u1",
    biotopeId: "b1",
    geometryKind: "area",
    biotopeCode: "05110",
    biotopeName: "Frischwiesen",
    protectionCode: "0",
    protectionText: "Kein geschützter Biotop",
    lrtCode: null,
    lrtName: null,
    lrtGrade: null,
    mappingMethod: "C",
    mappedFirst: "2009-06-01",
    mappedLast: "2019-07-12",
    share: 0.35,
    lengthM: null,
    sourceId: "lfu-bb-biotopkataster",
    ...partial,
  };
}

describe("habitatFacts", () => {
  it("states what the Kataster records, in its own words, with the statute", () => {
    const [fact] = habitatFacts([overlap({ protectionCode: "1", protectionText: "geschützter Biotop nach § 18" })]);
    assert.equal(fact!.protectedDe, "im Biotopkataster als „geschützter Biotop nach § 18“ erfasst (§ 30 BNatSchG i. V. m. § 18 BbgNatSchAG)");
    assert.equal(fact!.extentDe, "35 % der Zelle");
    assert.equal(fact!.mappedDe, "kartiert 2019, vollständige Biotoptypenkartierung");
  });

  it("ignores the Kataster's placeholder date 1111-11-11", () => {
    const [fact] = habitatFacts([overlap({ mappedLast: "1111-11-11", mappedFirst: "1996-05-02" })]);
    assert.equal(fact!.mappedDe, "kartiert 1996, vollständige Biotoptypenkartierung");
    const [none] = habitatFacts([overlap({ mappedLast: "1111-11-11", mappedFirst: "1111-11-11" })]);
    assert.equal(none!.mappedDe, "vollständige Biotoptypenkartierung");
  });

  it("names the habitat type and its conservation grade in the Kataster's labels", () => {
    const [fact] = habitatFacts([overlap({ lrtCode: "6510", lrtName: "Magere Flachland-Mähwiesen", lrtGrade: "B" })]);
    assert.equal(fact!.lrtDe, "FFH-Lebensraumtyp 6510 Magere Flachland-Mähwiesen");
    assert.equal(fact!.gradeDe, "Erhaltungsgrad gut (B)");
  });

  it("drops area overlaps under 1 % but keeps every line and point", () => {
    const facts = habitatFacts([
      overlap({ biotopeId: "tiny", share: 0.005 }),
      overlap({ biotopeId: "hedge", geometryKind: "line", share: null, lengthM: 84.4, biotopeName: "Hecken" }),
      overlap({ biotopeId: "pond", geometryKind: "point", share: null, biotopeName: "Kleingewässer" }),
    ]);
    assert.deepEqual(facts.map((f) => f.biotopeId).sort(), ["hedge", "pond"]);
    assert.equal(facts.find((f) => f.biotopeId === "hedge")!.extentDe, "84 m in der Zelle (Linienbiotop)");
  });

  it("lists protected biotopes first, then habitat types, and flags aerial-only records", () => {
    const facts = habitatFacts([
      overlap({ biotopeId: "plain", share: 0.9 }),
      overlap({ biotopeId: "lrt", lrtCode: "9130", share: 0.2 }),
      overlap({ biotopeId: "prot", protectionCode: "1", share: 0.1, mappingMethod: "A" }),
    ]);
    assert.deepEqual(facts.map((f) => f.biotopeId), ["prot", "lrt", "plain"]);
    assert.equal(facts[0]!.aerialOnly, true);
  });
});

describe("habitat summary", () => {
  it("never reads an empty Kataster entry as the absence of a biotope", () => {
    assert.match(habitatSummaryDe(summariseHabitat([])), /selektiv/);
    assert.match(HABITAT_CAVEAT_DE, /heißt das nicht, dass hier kein geschütztes Biotop liegt/);
  });

  it("counts biotopes, protected ones and habitat types", () => {
    const summary = summariseHabitat(
      habitatFacts([overlap({ biotopeId: "a", protectionCode: "1" }), overlap({ biotopeId: "b", lrtCode: "3150" })]),
    );
    assert.deepEqual(summary, { biotopes: 2, protectedBiotopes: 1, habitatTypes: 1 });
    assert.equal(habitatSummaryDe(summary), "2 Biotope im Biotopkataster erfasst, 1 davon als geschützt, 1 mit FFH-Lebensraumtyp");
  });
});
