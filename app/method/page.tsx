// Method page — how sela scores, in public, with weights and sources listed
// (docs/product/mvp.md §7). Rendered from criterion_definition rows once the
// Phase 2 schema exists, so it cannot drift from the scoring code in effect
// (docs/architecture/roadmap-to-first-deployment.md §5.1). Static placeholder
// until then.

export default function MethodPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "40rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Method</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        The criteria catalogue, weights, and sources behind sela&apos;s scores
        will be published here once the domain model and criteria catalogue
        (docs/domain/scoring-criteria.md, 0.2.x) and the scoring engine
        (0.2.1) exist.
      </p>
    </main>
  );
}
