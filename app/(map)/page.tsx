// Map explorer — the map-first primary surface (design-language.md §3).
//
// This is the Phase 1 (0.2.0) skeleton: it proves the route and the
// container path, nothing more. There is no pilot-region data to show yet
// (docs/data/sources.md gates that), and basemap serving is Phase 3 work
// (docs/architecture/adr-0003-basemap.md). The map itself, the parcel
// search, and scenario comparison land in 0.2.1 / 0.3.0.

export default function MapExplorerPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>sela</h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: "32rem", margin: 0 }}>
        Map explorer arrives once pilot-region data is loaded (0.2.1) and the
        four-scenario comparison ships (0.3.0). This container confirms the
        deployment path works.
      </p>
    </main>
  );
}
