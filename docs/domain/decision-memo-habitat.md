# Decision memo — nature capital as categories from the LfU *Biotopkataster*

**Version band:** `0.3.x` · **Status:** **implemented, pending the owner's confirmation in review.**
Decided on 2026-09-28 under the owner's instruction to work through the whole roadmap at once;
each choice is the conservative option and open to revision in the pull request. · **Last
updated:** 2026-09-28 · Step 4 of `docs/product/roadmap-pilot-demo.md`

Step 4 was to show habitat as **facts, not a score** (decision D5 of 2026-09-24,
`scoring-criteria.md` §4.3): protected biotope yes/no, FFH *Lebensraumtyp* and its conservation
status. It was **blocked** on an INSPIRE Art. 13(1)(e) restriction note on the Biotopkataster's
metadata, to be clarified with LfU.

**Evidence.** `docs/data/sources.md` §2.12 (read 2026-09-28); the ingest's counts in
`docs/domain/evidence/2026-09-28-habitat/`.

---

## 1. What reading the note at source showed

- **Art. 13(1)(e) is intellectual property**, not personal data or species locations. The note
  reads *"Öffentlicher Zugriff beschränkt entsprechend Artikel 13(1)(e) der INSPIRE-Richtlinie:
  e) aufgrund nachteiliger Auswirkungen auf die Rechte des geistigen Eigentums"*.
- It sits on the **service** records (WFS, WMS) only. The **dataset** record has no access
  constraint. The dataset's own documentation says *"Zugriffsbeschränkung keine"* and *"Kosten
  keine"*, and LfU publishes the full dataset as an open download.
- The remaining gap is the **licence**: the metadata says `dl-de/by-2-0`, the archive's
  documentation says CC BY 4.0. **Both** allow changed, public use with attribution. It is a
  question for LfU, not a blocker.

## 2. Decisions (2026-09-28, under the owner's delegation)

| # | Question | Decision |
|---|---|---|
| H1 | Use the Biotopkataster? | **Yes.** Source `lfu-bb-biotopkataster`, confirmed in the manifest, pinned and checksummed. The notice names LfU, the dataset and its URL (the documentation's example) under the licence the metadata states, with the change notice |
| H2 | What is shown | Per cell, from areas, lines (hedges, ditches) and points (small waters): biotope type; the Kataster's protection text where it records the biotope as protected (codes `1`, `2`); FFH habitat type and its conservation grade, in the Kataster's own labels; share or length; mapping year and method (with "nicht im Gelände überprüft" for aerial-only records). **No score, no sum, no colour scale** |
| H3 | Small overlaps | Area biotopes under **1 %** of a cell are not listed — the same line as for the Prüfhinweise (digitising accuracy 1:10 000). Lines and points are listed whenever they touch the cell. Every overlap is stored (`habitat_overlap`) |
| H4 | Does a protected biotope change the PV class or add a Prüfhinweis? | **No, not in this step.** It is shown in the nature-capital section, not in the PV classification. Whether § 30 biotopes should become a Prüfhinweis for PV is a scoring decision **left to the owner** (see §4) |
| H5 | Wording | Always what the *Kataster records* ("im Biotopkataster als „geschützter Biotop nach § 18“ erfasst"), never a legal finding. Every surface carries the caveat that the Kataster is selective outside FFH areas and Großschutzgebiete, and that a missing entry is not evidence of absence |
| H6 | Where | Parcel page (full list), selection panel (one line), scenario comparison (one line under the table — nature capital stays *noch nicht modelliert* as a quantity), site summary and side-by-side comparison (Step 5), method page |

## 3. Result on the Uckermark (`a_overlaps.out`)

| | Cells (of 117 191) |
|---|---|
| with at least one listed biotope | 62 488 |
| with a biotope the Kataster records as protected | 39 940 |
| with an FFH habitat type | 25 773 |

A third of the records rest on colour-infrared aerial interpretation (`INTEN = A`) without a field
visit. The screen says so per biotope.

## 4. The finding that needs the owner

**16 519 cells classed for PV as *ohne Einschränkung* (12 124) or *eingeschränkt* (4 395) contain
a biotope the Kataster records as protected.** § 30 Abs. 2 BNatSchG prohibits acts that destroy or
significantly impair protected biotopes. Today the PV class does not see this; the parcel page
does. Options for a later gate:

- **H4-a:** keep as is — nature capital shown, not used for PV.
- **H4-b:** add a Prüfhinweis for PV where a protected biotope covers at least 1 % of the cell
  (the map's dashed contour would then also mark these cells).
- **H4-c:** treat a large protected-biotope share like a Naturschutzgebiet (an exclusion). Not
  recommended: the Kataster is selective, and § 30 allows exceptions (§ 30 Abs. 3).

`§ 30 BNatSchG` and `§ 18 BbgNatSchAG` would have to be read at source before any of these is
written as a rule.

## 5. Questions for LfU (Referat N3, biotopkartierung@lfu.brandenburg.de)

1. Which licence governs the BBK Gesamtdatenbestand: `dl-de/by-2-0` (metadata, WFS) or CC BY 4.0
   (`doku_bbk_20260420.pdf`)? What is the exact attribution, given the download directory names
   "GeoBasis-DE / LGB"?
2. Please confirm that the Art. 13(1)(e) note on the service records does not restrict
   re-publishing derived facts.
3. Please confirm that sela may show, per ~2.6 ha cell, the presence of a biotope recorded as
   protected, its FFH *Lebensraumtyp* and its *Erhaltungsgrad*.
4. How should sela word a missing entry, and records mapped only from aerial imagery?
5. How are areas "in Bearbeitung" marked, so sela can show where the Kataster has gaps?

## Risks

- **Legal:** the closest sela comes to stating a protection status. Mitigated by quoting the
  Kataster's words, naming it as the source, and the caveat on every surface.
- **Licence:** two licence statements. Both permit the use; the notice satisfies the stricter
  reading; the question is put to LfU.
- **Credibility:** absence of an entry is easy to misread as "no nature value". The caveat says
  the opposite on every surface where it could be read that way.
