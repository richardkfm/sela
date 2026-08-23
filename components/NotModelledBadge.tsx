// "Not yet modelled" is a first-class, neutral state (mvp.md §8.3,
// design-language.md §8) — never rendered as zero, never silently omitted.

export function NotModelledBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.5rem",
        borderRadius: "0.3rem",
        border: "1px dashed var(--text-secondary)",
        color: "var(--text-secondary)",
        fontSize: "0.85rem",
      }}
    >
      Noch nicht modelliert
    </span>
  );
}
