// "Trifft nicht zu" (ADR-0008 §3): the method covers this cell and finds
// nothing to measure — e.g. no peat soil for a peat-emission metric. A
// statement, not a gap, so it is plain text rather than the dashed box of
// "noch nicht modelliert" (NotModelledBadge): the two must never look alike,
// because they make different claims. Never rendered as zero.

export function NotApplicableBadge({ reasonDe }: { reasonDe: string | null }) {
  return (
    <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
      Trifft nicht zu
      {reasonDe && <span style={{ display: "block", fontSize: "0.8rem" }}>{reasonDe}</span>}
    </span>
  );
}
