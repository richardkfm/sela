// How technologies and scenarios are named on screen, in one place, so no page
// prints a raw id like `develop_pv` or `preserve`.

import { scenarioToTokenKey, scenarioTokens } from "@/lib/design/tokens";
import { SCENARIOS, TECHNOLOGIES, type Scenario, type Technology } from "./types";

export const TECHNOLOGY_LABEL_DE: Record<Technology, string> = {
  pv: "Solar-PV",
  agripv: "Agri-PV",
  wind: "Wind",
};

/** A criterion's applies_to entry: a technology, or — for inputs to outcome methods — a scenario. */
export function appliesToLabel(entry: string): string {
  if ((TECHNOLOGIES as readonly string[]).includes(entry)) return TECHNOLOGY_LABEL_DE[entry as Technology];
  if ((SCENARIOS as readonly string[]).includes(entry)) return scenarioTokens[scenarioToTokenKey[entry as Scenario]].labelDe;
  return entry;
}
