// What every printed comparison carries (mvp.md F5): its sources, its date and
// the advisory note — "an export that cannot cite itself does not render". On
// screen the same sources are listed in the page itself; this block is the
// printed page's own citation, so it is shown in print only.

import { SourceAttribution } from "@/components/SourceAttribution";
import type { SourceRow } from "@/lib/db/queries/criteria";

const DATE = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });

export function PrintFooter({ sources, methodVersions }: { sources: readonly SourceRow[]; methodVersions: readonly string[] }) {
  return (
    <footer className="print-only" style={{ marginTop: "1.5rem", fontSize: "8pt", borderTop: "1px solid #999", paddingTop: "0.5rem" }}>
      <p style={{ margin: "0 0 0.3rem" }}>
        sela · Stand {DATE.format(new Date())} · Methoden {methodVersions.join(", ")}. sela ist beratend: keine Planungs-
        oder Genehmigungsaussage.
      </p>
      <p style={{ margin: 0 }}>
        Quellen:{" "}
        {sources.map((source, i) => (
          <span key={source.id}>
            {i > 0 && " · "}
            <SourceAttribution source={source} />
          </span>
        ))}
      </p>
    </footer>
  );
}
