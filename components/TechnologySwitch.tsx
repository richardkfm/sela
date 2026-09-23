"use client";

// The technology switch, shared by the explorer and the 3D preview. Each
// option carries its swatch with its hatch — the switch doubles as the key
// to which colour means which technology (design-language.md §4.3).

import { scenarioTokenCssVar, scenarioTokens, technologyToTokenKey } from "@/lib/design/tokens";
import { TECHNOLOGY_LABEL_DE } from "@/lib/map/verdict-style";
import type { Technology } from "@/lib/scoring/types";

export function TechnologySwatch({ technology }: { technology: Technology }) {
  const key = technologyToTokenKey[technology];
  return (
    <span
      aria-hidden
      className={`swatch pattern-${scenarioTokens[key].secondaryEncoding}`}
      style={{ backgroundColor: `var(${scenarioTokenCssVar[key]})` }}
    />
  );
}

export function TechnologySwitch<T extends Technology | "status_quo">({
  value,
  onChange,
  options,
  label = "Technologie",
  statusQuoLabel = "Ist-Zustand",
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
  label?: string;
  statusQuoLabel?: string;
}) {
  return (
    <div className={`segmented${options.length > 3 ? " segmented-2x2" : ""}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
          {option === "status_quo" ? (
            <span aria-hidden className="swatch" style={{ backgroundColor: "var(--scenario-status-quo)" }} />
          ) : (
            <TechnologySwatch technology={option as Technology} />
          )}
          {option === "status_quo" ? statusQuoLabel : TECHNOLOGY_LABEL_DE[option as Technology]}
        </button>
      ))}
    </div>
  );
}
