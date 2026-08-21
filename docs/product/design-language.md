# sela design language

**Version band:** `0.1.x` (planning) · **Status:** first draft · **Last updated:** 2026-08-21

This document exists so that "it has to look good" is a standard someone can be held to, rather than a matter of taste re-argued in every session. Deviating from it triggers the confirmation gate in `CLAUDE.md` §3.

---

## 1. Register

**sela reads as a data publication, not as software.** The reference point is a newspaper graphics desk — Financial Times, NZZ, ZEIT Online, NYT graphics — where the visual craft exists to make an argument legible, and every mark on the page is carrying information.

This is a working requirement, not vanity. sela's outputs are projected in council chambers, screenshotted by journalists, pasted into planning documents, and shared by citizens' initiatives. The presentation is part of whether the argument is taken seriously.

Three words to design against: **serious, spare, confident.**

## 2. Anti-patterns

Named explicitly, because "modern" does not enforce itself and every implementer drifts toward a different default.

**Not desktop GIS.** No bevelled panels, no dense toolbars of small icons, no layer trees dominating the viewport, no default QGIS/ArcGIS output styling, no grey-on-grey chrome competing with the map. If it looks like a specialist tool, the public audience is lost before reading anything.

**Not a crypto or fintech dashboard.** No neon-on-black, no glassmorphism, no gradient blobs, no glow or bloom, no 3D or metallic marks, no animated counters, no dark theme chosen for drama. This register signals speculation — precisely the wrong association for a tool about public land.

**Not SaaS marketing.** No stock photography of wind turbines at golden hour, no rounded-pill everything, no illustration that carries no information, no unearned superlatives in the interface copy.

**Not decorative charting.** No dual axes, no rainbow ramps, no pie charts of more than two parts, no 3D bars, no chart junk. See §6.

## 3. Layout and restraint

- **Map-first.** The map is the primary surface, not a widget inside a dashboard. Panels overlay or dock beside it; they do not surround it.
- **Chrome is quiet.** Controls recede until needed. The interface should look near-empty on first load, with the map and one clear entry point.
- **Data is the only thing allowed to be loud.** Saturation, weight, and contrast are budgeted for information. If a UI element is competing with a data mark for attention, the UI element is wrong.
- **Generous whitespace, tight information.** Space between groups; no space wasted inside them. Density is fine where it is legible — sparse is not the same as shallow.
- **One accent action per screen.** The primary action is obvious; everything else is secondary or tertiary.

## 4. Colour

### 4.1 The rule
The basemap is **desaturated**, so that data carries all colour. Colour is assigned by **meaning**, fixed permanently, never by rank, never for decoration, and never recycled when a filter changes what is on screen.

### 4.2 Semantic palette

Scenario and technology colours, validated as a categorical set (method and evidence in §4.3):

| Role | Meaning | Light | Dark | Secondary encoding |
|---|---|---|---|---|
| **Status quo** | The land as it is today — the baseline | `#6f6e6a` neutral | `#8b8a85` neutral | Plain fill, no pattern |
| **Solar PV** | `develop` — ground-mounted | `#eda100` amber | `#c98500` amber | 45° hatch |
| **Agrivoltaics** | `develop` — dual use | `#eda100` amber | `#c98500` amber | 45° **cross**hatch — same hue as PV, because it *is* PV; the crosshatch carries the dual use |
| **Onshore wind** | `develop` — wind | `#2a78d6` blue | `#3987e5` blue | 135° hatch |
| **Preserve** | Keep what is already there | `#008300` green | `#008300` green | Solid fill |
| **Restore** | Actively improve it | `#e87ba4` magenta | `#d55181` magenta | Stipple |

Two decisions worth their reasoning:

- **`status quo` is neutral, not absent.** It is the reference every other scenario is measured against, so it is a deliberate grey — the role a neutral midpoint plays in a diverging scale — not a lack of colour.
- **`restore` is not a second green.** The intuitive choice is teal beside conservation green, and it was rejected on measurement: green and teal fail the normal-vision separation floor in dark mode (ΔE 11.9, floor 15). The product reason points the same way — preserving and restoring are *different actions*, and users must never confuse "leave it alone" with "intervene to improve it". Magenta reads as regeneration and is unmistakable beside green.

### 4.3 Validation — measured, not asserted

The palette was checked with the data-visualisation validator across all pairs, in both modes:

| Mode | CVD separation | Normal-vision floor | Contrast vs. surface |
|---|---|---|---|
| Light | worst pair ΔE 13.0 (protan) · tritan 5.8 | worst pair ΔE 19.6 — **pass** (floor 15) | amber 2.11:1, magenta 2.62:1 — **below 3:1** |
| Dark | worst pair ΔE 6.9 (protan, green↔amber) | worst pair ΔE 19.3 — **pass** | all ≥ 3:1 — pass |

Two obligations follow directly, and they are not optional:

1. **Colour is never the sole encoding.** Dark-mode green↔amber sits at ΔE 6.9, inside the band that is only permissible with secondary encoding. The hatch/crosshatch/solid/stipple column in §4.2 is what makes the palette legal, not a stylistic flourish.
2. **Amber and magenta always carry a visible label or a table view** in light mode, since both fall below 3:1 against the light surface. They may not be used as the only carrier of a value.

**Greyscale printing — the constraint that colour cannot satisfy.** Municipal council packets are printed in black and white. Measured greyscale luminance of the light palette:

| Role | Approx. grey |
|---|---|
| Solar PV amber | 68% |
| Restore magenta | 61% |
| Onshore wind blue | 47% |
| Preserve green | 44% |
| Status quo grey | 43% |

Green, blue, and status-quo grey collapse to within 4 percentage points of each other. No hue selection fixes this — it is what monochrome conversion does. Therefore: **every scenario fill ships with its pattern from §4.2, and every printable export is verified in greyscale before it is called done.** A comparison that is unreadable when photocopied has failed at exactly the moment it mattered.

### 4.4 Magnitude
Suitability and outcome magnitudes use a **single-hue sequential ramp**, light → dark, in the hue of whatever it is measuring. Where a value is genuinely two-sided — better or worse than the status quo baseline — use a **diverging** scale with two opposed hues and a neutral grey midpoint. Never a rainbow. Every ramp states its direction in the legend.

### 4.5 Ground
Warm near-white in light mode, deep near-black in dark. Never pure `#ffffff` or `#000000` — both are harsher on a projector than they look on a monitor, and sela will be projected.

## 5. Typography

- **One modern grotesk** across the product. Strong hierarchy comes from weight and size, not from mixing families.
- **Tabular numerals everywhere numbers are compared.** Figures in a comparison must align on the decimal, or the comparison is harder to read than a paragraph.
- **Units are never orphaned.** A number is always adjacent to its unit and its reference period — `1.4 GWh/a`, not `1.4` with the unit in a distant header.
- **Copy is plain.** Short sentences, no jargon where a common word exists, German technical terms kept when they are the precise legal term. The audience includes people reading it for the first time in a council meeting.
- **Typeface licensing for public deployment is an open question** (§11). Do not treat any specific family as settled.

## 6. Charts and marks

- **One axis.** Never two y-scales on one chart. Two measures of different magnitude become two charts, small multiples, or an indexed comparison.
- **Thin marks, recessive grid.** Axes and gridlines are structural, not decorative — they must sit visually behind the data.
- **Selective direct labels.** Label what matters; never a number on every point.
- **A legend whenever two or more series are shown**, and direct labels as well when there are four or fewer.
- **Values wear text colour, not series colour.** The coloured mark beside a number carries the identity; the number itself stays in ink.
- **A table view is always reachable** from any chart. It is the accessibility fallback, the print fallback, and the honesty fallback.

## 7. The shareable scenario card

This is how sela travels, and it is designed as a product object rather than as marketing output.

**Format.** A fixed-aspect export generated from any comparison, in 1200×630 (link preview) and 1:1 (feed), plus a print-oriented variant for documents.

**Contents, in order:**
1. The parcel — where it is, in words a non-local can place, and its size.
2. The headline outcome — one comparison stated as a sentence, not a chart title.
3. The two or three criteria that drove it, with values and units.
4. A single small visual carrying the comparison — legible at feed scale, so no more than a handful of marks.
5. **A provenance footer** — data sources, method version, generation date, and the advisory disclaimer.

**The binding rule:** *a card that cannot cite itself must not render.* If provenance is missing for any displayed value, the export fails rather than shipping an uncited claim. This is what makes shareability compatible with transparency instead of opposed to it — the most viral object sela produces is also its most rigorous one.

**Legibility bar:** readable at 400px wide, and readable in greyscale.

## 8. Confidence and uncertainty

Design quality raises the duty of honesty: a polished chart makes people trust it more, so uncertainty must be visible *in* the polish, not in a footnote.

- **Every criterion carries a confidence level**, and low confidence is visible at the point where the value influences a headline number — not only on the evidence screen.
- **Defined vocabulary:** reduced fill opacity plus a hatched edge for low-confidence marks; an explicit marker glyph beside low-confidence values; ranges rather than point estimates where the data supports only a range.
- **"Not yet modelled" is a real state** with its own neutral treatment. It is never rendered as zero, and never silently omitted from a comparison.
- **No false precision.** Significant figures reflect the input's actual resolution. A value derived from 100 m raster data is not displayed to the square metre.

## 9. Accessibility floor

Not a finishing task. sela is public-sector-facing in Germany, where BITV 2.0 (aligned with WCAG 2.2 AA) is the relevant standard.

- **Contrast:** 4.5:1 for body text, 3:1 for large text and meaningful UI boundaries. Where a data colour falls below 3:1 against its surface (§4.3), the relief rule applies — visible labels or the table view.
- **Never colour alone.** Pattern, label, or shape always accompanies hue. Already binding via §4.2.
- **Keyboard:** every map interaction has a keyboard path — parcel selection, layer switching, comparison. A map that only responds to a mouse excludes people the tool is explicitly for.
- **Focus states are visible and designed**, not the browser default suppressed for looks.
- **Motion:** honour `prefers-reduced-motion`; no animation carries information on its own.
- **Screen readers:** every chart has a text alternative and a table view; map features are reachable as a list.
- **Language:** the interface is German for the public-facing product; documentation is English. Content language is declared correctly for assistive technology.

## 10. Light and dark

**Light-first.** The primary contexts — projection in a meeting room, printing, embedding in a document, screenshots in an article — all favour light. Dark mode is supported and fully tokenised, never an automatic inversion: its colour steps are chosen and validated against the dark surface (§4.3), as separate work from the light palette.

Both modes are defined from the same **semantic tokens** (`--scenario-preserve`, `--surface-1`, `--text-secondary`), so a component is written once against roles and never against raw hex.

## 11. Open questions

| # | Question | Blocks |
|---|---|---|
| U8 | Basemap provider and its attribution and licensing terms — OSM-derived vector tiles vs. a commercial provider vs. an official German source. | The entire visual register, plus a legal attribution duty on every screen and every exported card |
| U9 | Wordmark, logo, and final public name — is "sela" the name it launches under? | Public identity, the card header, the domain |
| — | Typeface licensing for public deployment, including embedding in exported images. | Whether a chosen family is usable at all |

## 12. Checklist before shipping any interface work

- [ ] Does it match one of the anti-patterns in §2?
- [ ] Is every data colour semantic, fixed, and paired with a non-colour encoding?
- [ ] Do amber and magenta values carry a visible label in light mode?
- [ ] Is it readable in greyscale, verified by actually converting it?
- [ ] Do all comparable figures use tabular numerals and carry their units?
- [ ] Is low confidence visible where the number is, not only in the evidence view?
- [ ] Is there a keyboard path and a table view?
- [ ] Would a screenshot of this be publishable in an article without redesign?
