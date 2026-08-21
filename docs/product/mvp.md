# sela MVP — product definition

**Version band:** `0.1.x` (planning) · **Status:** first draft · **Last updated:** 2026-08-21

This is the source of truth for what the first version of sela does and does not do. Later domain, data, and architecture documents refine it; they do not silently widen it.

---

## 1. Objective

**Let anyone select a parcel of land in Germany and see, side by side, what happens under four futures — left as it is, developed for renewable energy, deliberately preserved, or restored — with every claim traceable to a named, cited criterion.**

Two things that objective deliberately excludes: sela does not tell you which future to pick, and sela does not produce a number whose reasoning is hidden.

## 2. Target users

| User | The question they arrive with | What they must be able to do in the MVP | What would make them dismiss it |
|---|---|---|---|
| **Municipality** (planning office, council, mayor) | Where should we steer development, and can we defend the reasoning publicly? | Compare several parcels in the municipal area; export a comparison that survives a council packet, including in black-and-white print | Output they cannot cite, or that contradicts their own *Flächennutzungsplan* without explaining why |
| **Investor** | Which sites are viable, and where is the conflict risk? | See suitability together with the constraints that limit it, before site visits | Optimism about parcels with obvious legal or acceptance barriers |
| **Project developer** | Which parcels are worth pursuing first? | Rank candidates and see the single criterion limiting each one | A ranking that cannot be interrogated criterion by criterion |
| **The public** (citizen, initiative, journalist) | Why this field, and what is lost? | Get a plain-language answer, follow it down to the evidence, and share it | Expert-only framing, or confident claims with no visible uncertainty |

The same evidence serves all four. Depth is layered — headline, then criteria, then sources — never split into separate "simple" and "expert" truths.

## 3. Non-goals for the MVP

Explicitly out of scope. Adding any of these requires the confirmation gate in `CLAUDE.md` §3.

- **No permitting workflow.** sela does not manage applications, submissions, or approvals, and never implies a permission outcome.
- **No financial modelling.** No LCOE, no revenue projections, no yield forecasts framed as investment advice.
- **No live grid data.** Real-time or contractual grid-capacity data is out; if grid proximity appears at all, it is a static, clearly-dated indicator (see U3).
- **No geographies outside Germany.** The data model may not assume portability it has not been tested for.
- **No ownership or parcel-holder data.** Personal data about landowners is out of scope entirely.
- **No user-generated scenarios or custom weighting in v0.1.** Weights are published and fixed; user-adjustable weights are a later band once the method is stable enough to survive being changed.
- **No automated environmental impact assessment.** sela produces pre-assessment signals, not an *Umweltverträglichkeitsprüfung*.
- **No mobile-native applications.** Responsive web only.

## 4. Technologies in scope

Three, chosen because they compete for the same land and produce genuinely different trade-offs.

### 4.1 Ground-mounted solar PV (*Freiflächen-Photovoltaik*)
Suitability driven by: solar irradiation, slope and aspect, parcel size and contiguity, land-cover class, distance to grid connection (U3), designated-area eligibility (e.g. corridors along motorways and railways), and exclusion by protection status.
Trade-off character: high energy density, high land occupation, moderate reversibility.

### 4.2 Agrivoltaics (*Agri-Photovoltaik*)
Suitability driven by: the PV criteria above, plus current crop type and its shade tolerance, soil quality (*Bodenzahl* / *Ackerzahl*), field geometry and machinery access, and continued agricultural use.
Trade-off character: dual use — lower energy density than ground-mounted PV, far lower loss of agricultural function. This is the scenario where "gained vs. given up" is least obvious and therefore most worth showing.

### 4.3 Onshore wind
Suitability driven by: wind resource at hub height, statutory and state-specific setback distances from settlements, protection-area and species constraints (notably raptor and bat sensitivity), terrain and access, and distance to grid connection (U3).
Trade-off character: very high energy per hectare occupied, but the widest zone of conflict and acceptance effects.

Each technology's criteria are catalogued with sources and weights in `docs/domain/scoring-criteria.md` (`0.2.x`). Nothing above is settled until it is cited there.

## 5. Scenarios

Four, always compared, never shown alone. Every scenario produces the **same outcome dimensions** (§8.3) so they are genuinely comparable rather than four differently-shaped stories.

| Scenario | Question it answers | Output shape |
|---|---|---|
| `status quo` | What does this land do today? | Baseline values across all outcome dimensions — the reference every other scenario is measured against |
| `develop` | What is gained if it is built on? | Per technology: a suitability verdict with its limiting criterion, plus outcome deltas vs. baseline |
| `preserve` | What is preserved if it stays untouched? | The value already present and at risk — carbon stock, habitat, water retention, soil function — expressed as what is protected rather than as zero development |
| `restore` | What improves if it is restored or renatured? | Realistic restoration options for this land type, with the outcome uplift each would deliver and an indicative time-to-effect |

Two rules that keep the comparison honest:

1. **`status quo` is never the implied default.** Doing nothing is a choice with its own gains and losses, and is displayed with the same prominence as the others.
2. **`preserve` and `restore` are quantified, not residual.** If a scenario's value can only be expressed as the absence of the others, the outcome dimension is not yet modelled well enough to ship.

## 6. First user flows

**F1 — Find a parcel.** Search by address, municipality, or coordinates, or click the map. → The parcel is identified with its land-cover class and current use.

**F2 — Understand suitability.** For a selected parcel, see per technology whether it is suitable, and immediately *why*: the two or three criteria driving the verdict, and the single criterion that limits it most.

**F3 — Compare scenarios.** See all four scenarios for the parcel across the shared outcome dimensions, with the trade-off — what is gained, what is given up — stated in words, not left for the reader to infer from a chart.

**F4 — Inspect the evidence.** From any criterion or number, reach its source: dataset, licence, resolution, date, weight, direction, and confidence. This path must exist from every displayed value. It is the product.

**F5 — Export and share.** Produce a scenario card (`docs/product/design-language.md` §7) or a printable comparison. Every export carries its sources, its date, and its advisory disclaimer — an export that cannot cite itself does not render.

**F6 — Compare parcels** *(v0.3, municipality flow).* Place several parcels side by side under one scenario to answer "where should this go" rather than "what should happen here".

## 7. First screens

| Screen | What it must make obvious within seconds |
|---|---|
| **Map explorer** | Where you are, what the colours mean, and that a parcel is selectable. Data carries the colour; the basemap stays quiet. |
| **Parcel detail** | What this land is today, and the technology verdicts with their limiting criterion visible without scrolling. |
| **Scenario comparison** | That four futures are being compared on identical dimensions — and where the real trade-off sits. The centrepiece screen. |
| **Criterion / evidence view** | Where a number came from, how much it counts, and how confident it is. Reachable from any value. |
| **Method page** | How sela scores, in public, with weights and sources listed. Static, citable, versioned alongside the scoring logic. |

## 8. Core data and scoring concepts

### 8.1 Spatial unit
The unit everything attaches to. The choice between the cadastral *Flurstück* and a generated grid is **open (U1)** and is the single decision with the widest downstream effect — on licensing cost, on data joins, and on whether results are addressable in the way a municipality expects.

### 8.2 The criterion record
The atomic unit of explanation. Every criterion carries, at minimum:

| Field | Meaning |
|---|---|
| `id` | Stable identifier, referenced by outputs and by the method page |
| `name` | Human-readable, in EN and DE |
| `source` | Dataset, publisher, version, retrieval date |
| `licence` | Including whether derived outputs may be published (U7) |
| `value` / `unit` | The measured value for this spatial unit |
| `direction` | Whether higher is better, worse, or non-monotonic |
| `weight` | Contribution to its score, published on the method page |
| `confidence` | Data quality and applicability at this location |
| `applies_to` | Which technologies and scenarios it participates in |

**The rule:** no composite score may hide its parts. Any displayed aggregate must be expandable into the criterion records that produced it, with their weights. A criterion without a source and licence does not enter a score.

### 8.3 Outcome dimensions
The shared axes on which all four scenarios are compared — so that "develop" and "restore" are answerable in the same terms:

- **Energy** — annual generation potential and capacity
- **Climate** — greenhouse-gas effect, including soil and vegetation carbon, not only avoided emissions
- **Nature capital** — habitat value and connectivity, referenced to an established method such as the *Biotopwertverfahren* (U2)
- **Soil and water** — soil function, sealing, erosion risk, groundwater recharge and retention
- **Land use** — area occupied, agricultural function retained or lost, reversibility
- **Local benefit** — municipal revenue participation and local value retention, where a defensible public basis exists

Not every dimension will be quantifiable for every scenario in v0.1. Where one is not, it is shown as *not yet modelled* — never silently omitted, and never filled with a placeholder number.

### 8.4 Constraints vs. scores
Some factors exclude a technology outright (protection status, statutory setbacks); others merely reduce suitability. Whether hard constraints act as filters or as heavy penalties is **open (U4)**, and it changes both the interface and sela's legal exposure.

### 8.5 Confidence
Confidence is carried per criterion and surfaced in the interface, with a defined visual treatment (`design-language.md` §8). A low-confidence input must be visible as such at the point where it influences a headline number.

## 9. Open questions

Recorded rather than assumed. Each blocks or reshapes work in a later band.

| # | Question | Blocks |
|---|---|---|
| U1 | Spatial unit: ALKIS *Flurstück* vs. generated grid (e.g. 100 m hex)? ALKIS is per-*Bundesland* and often fee-based. | Data model, licensing budget, `0.2.x` architecture |
| U2 | Which nature-capital indicators are defensible for v0.1 — soil carbon, biotope value points, habitat connectivity, groundwater recharge? Must be citable, never invented. | `preserve` and `restore` scenarios |
| U3 | Is grid-connection capacity (*Netzverknüpfungspunkte*) in MVP scope? Strongest real-world suitability driver; hardest public data to obtain. | PV and wind suitability credibility |
| U4 | Hard regulatory constraints as filters or as scored penalties? | Interface design, legal exposure |
| U5 | How much of the public interface is anonymous vs. account-gated? | Transparency positioning, infrastructure cost |
| U6 | Disclaimer posture — how prominently is advisory-only stated, and where? | Legal review before public release |
| U7 | Per-source licensing (dl-de/by-2-0, ODbL, restricted) and whether derived scores may be redistributed. | Whether the platform can be public at all |
| U8 | Basemap provider and its attribution and licensing terms. | Visual register, legal attribution — see `design-language.md` |
| U9 | Wordmark, logo, and final public name. | Public launch identity — see `design-language.md` |

## 10. Success criteria

Each stated as something demonstrable, not as a feeling.

### v0.1 — the plan is defensible
- A reader unfamiliar with the project can state sela's objective, its four scenarios, and its non-goals after reading `README.md` and this document.
- Every open question above is recorded with what it blocks, and none has been silently resolved by assumption.
- The visual standard is specific enough that two different implementers would produce recognisably the same product.
- No document asserts a data source, coverage, licence, or regulatory distance that has not been verified.

### v0.2 — the domain is decided
- The spatial unit is chosen and recorded as an ADR, with its licensing consequences stated (U1).
- A data-source inventory exists for one pilot region, with licence and redistributability per dataset (U7).
- The criteria catalogue for all three technologies is written, each criterion carrying source, direction, weight rationale, and citation.
- The four scenarios are specified precisely enough to be implemented without further product input.

### v0.3 — it works end to end on real land
- A real parcel in a pilot *Landkreis* can be selected and compared across all four scenarios, with real data.
- From any displayed number, a user can reach its criterion record with source, licence, weight, and confidence — flow F4 works everywhere, with no dead ends.
- The method page is published and matches the scoring code in effect.
- A scenario card exports with sources, date, and disclaimer, and is legible in a social feed and in black-and-white print.
- A screenshot of the comparison screen can be published without redesign — the presentation bar in `design-language.md` is met, not deferred.
- At least one municipality or planning practitioner has used it on a parcel they actually care about, and their objections are recorded.
