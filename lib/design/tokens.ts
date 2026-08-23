/**
 * Semantic design tokens, sourced from docs/product/design-language.md §4.2–4.3.
 * Components read these roles (or the matching CSS custom properties in
 * app/globals.css, which must stay in sync with this file) — never a raw hex
 * value, per design-language.md §10.
 */

import type { Scenario, Technology } from "@/lib/scoring/types";

export type SecondaryEncoding =
  | "none"
  | "hatch-45"
  | "crosshatch-45"
  | "hatch-135"
  | "solid"
  | "stipple";

export interface ScenarioToken {
  /** English label. German label is the public-facing interface language (design-language.md §9). */
  label: string;
  labelDe: string;
  light: string;
  dark: string;
  /** Required alongside colour — design-language.md §4.3 obligation 1. */
  secondaryEncoding: SecondaryEncoding;
}

export const scenarioTokens = {
  statusQuo: {
    label: "Status quo",
    labelDe: "Ist-Zustand",
    light: "#6f6e6a",
    dark: "#8b8a85",
    secondaryEncoding: "none",
  },
  solarPv: {
    label: "Solar PV",
    labelDe: "Freiflächen-Photovoltaik",
    light: "#eda100",
    dark: "#c98500",
    secondaryEncoding: "hatch-45",
  },
  agriPv: {
    label: "Agrivoltaics",
    labelDe: "Agri-Photovoltaik",
    light: "#eda100",
    dark: "#c98500",
    secondaryEncoding: "crosshatch-45",
  },
  onshoreWind: {
    label: "Onshore wind",
    labelDe: "Windenergie",
    light: "#2a78d6",
    dark: "#3987e5",
    secondaryEncoding: "hatch-135",
  },
  preserve: {
    label: "Preserve",
    labelDe: "Erhalt",
    light: "#008300",
    dark: "#008300",
    secondaryEncoding: "solid",
  },
  restore: {
    label: "Restore",
    labelDe: "Renaturierung",
    light: "#e87ba4",
    dark: "#d55181",
    secondaryEncoding: "stipple",
  },
} as const satisfies Record<string, ScenarioToken>;

export type ScenarioTokenKey = keyof typeof scenarioTokens;

/** Joins lib/scoring/types.ts's schema-shaped Scenario to this file's presentation tokens. */
export const scenarioToTokenKey: Record<Scenario, ScenarioTokenKey> = {
  status_quo: "statusQuo",
  develop_pv: "solarPv",
  develop_agripv: "agriPv",
  develop_wind: "onshoreWind",
  preserve: "preserve",
  restore: "restore",
};

/** Joins lib/scoring/types.ts's Technology to this file's presentation tokens. */
export const technologyToTokenKey: Record<Technology, ScenarioTokenKey> = {
  pv: "solarPv",
  agripv: "agriPv",
  wind: "onshoreWind",
};

/**
 * CSS custom property name per scenario token — must stay in sync with
 * app/globals.css's `--scenario-*` declarations (that file's own header
 * comment says the same). Lets components read the theme-aware (light/dark)
 * colour via `var(...)` instead of hardcoding tokens.ts's light-mode hex.
 */
export const scenarioTokenCssVar: Record<ScenarioTokenKey, string> = {
  statusQuo: "--scenario-status-quo",
  solarPv: "--scenario-solar-pv",
  agriPv: "--scenario-agri-pv",
  onshoreWind: "--scenario-onshore-wind",
  preserve: "--scenario-preserve",
  restore: "--scenario-restore",
};

/**
 * Roles that fall below the 3:1 contrast floor in light mode
 * (design-language.md §4.3 obligation 2) and therefore may never be the sole
 * carrier of a value — a visible label or the table view is required.
 */
export const requiresVisibleLabelInLightMode: ScenarioTokenKey[] = [
  "solarPv",
  "agriPv",
  "restore",
];

export const surfaceTokens = {
  ground: { light: "#faf9f6", dark: "#161513" },
  surface1: { light: "#ffffff", dark: "#1f1e1b" },
  textPrimary: { light: "#1f1e1b", dark: "#f2f1ee" },
  textSecondary: { light: "#54524c", dark: "#b8b6b0" },
} as const;
