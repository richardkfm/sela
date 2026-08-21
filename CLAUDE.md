# CLAUDE.md — Working agreement for sela

This file governs how Claude Code works in this repository. Read it before doing anything else.

---

## 1. What sela is

**sela is a public-facing spatial decision-support platform that compares land-use scenarios for renewable energy, conservation, and restoration — starting in Germany.**

For any given parcel of land, sela must be able to answer four questions in plain language, with evidence:

| Question | Scenario it belongs to |
|---|---|
| Why is this site suitable for this technology? | `develop` (suitability) |
| What is gained if it is developed? | `develop` (outcome) |
| What is preserved if it remains untouched? | `preserve` |
| What improves if it is restored or renatured? | `restore` |

The product is **explainable comparison**, not suitability scoring. A number without a decomposable reason is not a sela output.

**Current state: pre-implementation.** The repository holds planning documents only. No stack has been chosen. See `docs/product/mvp.md` for scope and `docs/product/design-language.md` for the visual standard.

---

## 2. Planning-first workflow (mandatory)

The project is configured to start in plan mode (`.claude/settings.json`). This is deliberate. In this repository, **planning is the default mode of work and implementation is the exception that must be requested.**

For any non-trivial task, produce a plan with these seven parts, in this order, **before writing or changing anything**:

1. **Restate the task** in your own words. If your restatement differs from what was asked, that gap is the most valuable thing you will produce today — surface it.
2. **List assumptions** explicitly. Anything you had to decide in order to proceed is an assumption, including things that feel obvious.
3. **Identify unknowns and open questions.** Distinguish *blocking* (work is useless or unsafe if wrong) from *non-blocking* (proceed under a stated assumption). Record non-blocking unknowns in the relevant doc so they are not lost.
4. **Propose a phased plan**, mapped to the version ladder in section 6.
5. **Name the files** you will create or change, and say why each one.
6. **Call out risks** — technical, legal, data-availability, and credibility. "None" is almost never the right answer for this project.
7. **Wait for confirmation** when the change touches anything in section 3.

Trivial tasks (typo fixes, a link correction, a formatting repair) do not need the full ceremony. Use judgement, and err toward planning.

---

## 3. Confirmation gate

**Stop and get explicit confirmation before implementing** when the work may change any of the following:

- **Architecture** — storage, data model, spatial unit, serving/tiling strategy, choice of language or framework, service boundaries.
- **Scoring** — criteria, weights, normalization, aggregation, thresholds, or how a score is presented. Changing a weight changes what the public is told about real land.
- **Scope** — adding or removing a technology, scenario, geography, or user group; anything on the non-goals list in `docs/product/mvp.md`.
- **User-visible behavior** — flows, screens, labels, what a number means, what a map colour means.
- **Data sources and licensing** — adding a dataset, changing a source, or anything affecting whether derived outputs may be published.
- **Visual language** — deviating from `docs/product/design-language.md`, including its anti-pattern list.

Outside these six areas, proceed and report.

---

## 4. Product principles

These are constraints on output, not slogans. Each one is checkable.

### 4.1 Public explainability
Every score, ranking, and claim must decompose into named criteria, each with its source, licence, weight, direction, and confidence. If a user cannot get from a headline number to the evidence behind it in the interface, the feature is not finished. No opaque composites, no unexplained model output.

### 4.2 Scenario comparison
Land-use questions are comparative. A parcel is never shown as good or bad in isolation — it is shown as *this outcome under develop, that outcome under preserve, that other outcome under restore*. Any feature that presents a single scenario without its alternatives is incomplete by design.

### 4.3 Nature capital
What is preserved and what is restored are first-class outcomes, quantified with the same rigour as energy yield — never framed as the absence of development. Ecological indicators must be citable to an established method, never invented for convenience.

### 4.4 Multi-stakeholder design
Four audiences (municipalities, investors, project developers, the public) arrive with different questions and different literacy. The same underlying evidence must be legible to all of them. Never build a view that only an expert can read, and never dumb down by hiding the method — layer it instead.

### 4.5 Transparent trade-offs
sela does not recommend. It makes the trade-off visible and attributable: what is gained, what is given up, under which assumptions, with what confidence. Where evidence is weak, say so in the interface. Uncertainty is content, not an embarrassment.

### 4.6 Credible by design
The visual result is part of the argument. sela is projected in council meetings, screenshotted by journalists, and shared publicly — it must look like a serious data publication, not a grey GIS utility and not a crypto dashboard. All UI work conforms to `docs/product/design-language.md`, including its named anti-patterns and its accessibility floor.

**A note on the tension between 4.5 and 4.6:** a polished presentation makes people trust output *more*, so quality of design raises the duty of honesty. Confidence and provenance treatments are not optional decoration — they are what makes an attractive chart permissible.

---

## 5. Working conventions

- **Documents over code, until the domain is settled.** Prefer strengthening a planning document over writing speculative implementation.
- **No invented facts.** Do not state a dataset's coverage, licence, resolution, or a regulatory setback distance unless it has been verified. Mark unverified items explicitly as open questions.
- **German terms where they are the precise term.** Documents are written in English; keep `Flurstück`, `Flächennutzungsplan`, `Landschaftsschutzgebiet`, `Netzverknüpfungspunkt` in German rather than approximating them.
- **Record decisions where they belong.** Product scope in `docs/product/mvp.md`; visual decisions in `docs/product/design-language.md`; architecture decisions as ADRs in `docs/architecture/` once that phase begins.
- **Update `CHANGELOG.md`** in the same change that alters project scope, structure, or documents.
- **Advisory, not authoritative.** sela informs decisions; it does not grant, predict, or substitute for planning permission. Never write copy or code comments implying otherwise.

### Planned repository layout

Directories are created when a phase actually needs them, not in advance.

| Path | Contents | Phase |
|---|---|---|
| `docs/product/` | Product scope, MVP definition, design language | now |
| `docs/domain/` | Glossary, scenario semantics, scoring criteria catalogue | 0.1.x–0.2.x |
| `docs/data/` | Data-source inventory, licences, provenance, coverage | 0.1.x–0.2.x |
| `docs/architecture/` | ADRs and system design | 0.2.x |
| `data/` | Local working data — git-ignored, never committed | 0.3.x |
| Application code | Layout follows the architecture ADRs; not decided yet | 0.3.x |

---

## 6. Version ladder

Semantic Versioning, with these bands giving early versions meaning. State which band your work belongs to when you plan.

| Band | Meaning |
|---|---|
| `0.1.x` | Planning and documentation |
| `0.2.x` | Domain model and architecture |
| `0.3.x` | MVP foundations — data, scoring, first UI |
| `1.0.0` | First stable public MVP |

---

## 7. Quick checklist before you implement

- [ ] Have I restated the task and checked my restatement against what was asked?
- [ ] Are my assumptions written down?
- [ ] Have I separated blocking unknowns from ones I can proceed past?
- [ ] Does this touch anything in the confirmation gate (section 3)? If yes — did I get confirmation?
- [ ] Can every number this produces be traced to a named, cited criterion?
- [ ] Does this conform to the design language, including its anti-patterns and accessibility floor?
- [ ] Have I named the affected files and the risks?
