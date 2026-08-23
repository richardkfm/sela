// A scenario's colour swatch (with its mandatory secondary encoding
// pattern) plus its German label, always together — design-language.md
// §4.3 obligation 2: solarPv/agriPv/restore fall below the light-mode
// contrast floor and may never be the sole carrier of a value. Rendering
// the label alongside the swatch here, everywhere this component is used,
// satisfies that obligation by construction rather than by remembering to.

import { scenarioTokenCssVar, scenarioTokens, scenarioToTokenKey } from "@/lib/design/tokens";
import type { Scenario } from "@/lib/scoring/types";

export function ScenarioBadge({ scenario }: { scenario: Scenario }) {
  const tokenKey = scenarioToTokenKey[scenario];
  const token = scenarioTokens[tokenKey];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
      <span
        aria-hidden
        className={token.secondaryEncoding !== "none" ? `pattern-${token.secondaryEncoding}` : undefined}
        style={{
          display: "inline-block",
          width: "0.9rem",
          height: "0.9rem",
          borderRadius: "0.2rem",
          backgroundColor: `var(${scenarioTokenCssVar[tokenKey]})`,
          flexShrink: 0,
        }}
      />
      <span>{token.labelDe}</span>
    </span>
  );
}
