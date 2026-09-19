// The publisher's required Quellenvermerk, rendered where a source appears.
//
// docs/data/sources.md §7 condition 4 makes this a precondition for real data
// reaching a public screen, and ADR-0005 raises the stakes: sela traded ODbL's
// share-alike term for attribution licences, which is only a good trade if the
// attribution is actually shown.
//
// Hyperlinking is not decoration. dl-de/by-2-0 and CC BY 4.0 both require, on
// a web page, that the licence label link to the licence text — so when a
// source carries an attributionUrl the link is rendered, and when it does not
// the plain text is, rather than inventing a target.

import { isCitable, renderAttribution } from "@/lib/attribution";
import type { SourceRow } from "@/lib/db/queries/criteria";

export function SourceAttribution({ source }: { source: SourceRow }) {
  if (!isCitable(source)) {
    return (
      <span style={{ color: "var(--text-secondary)" }}>
        Kein Quellenvermerk hinterlegt — diese Quelle ist nicht zitierfähig und darf nicht
        veröffentlicht werden.
      </span>
    );
  }

  const notice = renderAttribution(source);

  return (
    <span>
      {source.attributionUrl ? (
        <a href={source.attributionUrl} rel="license noopener noreferrer" target="_blank">
          {notice}
        </a>
      ) : (
        notice
      )}
    </span>
  );
}
