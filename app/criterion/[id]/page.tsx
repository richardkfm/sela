// Evidence view (roadmap §5.1) — flow F4: from any displayed criterion,
// reach its source: dataset, licence, resolution, date, weight, direction,
// confidence. Reachable from every criterion id shown elsewhere; no dead
// ends. Phase 3 (0.3.0) fixture data — see IllustrativeBanner.

import Link from "next/link";
import { notFound } from "next/navigation";
import { IllustrativeBanner } from "@/components/IllustrativeBanner";
import { getCriterionDefinition, getSource } from "@/lib/db/queries/criteria";

// Reads live scored data — see app/(map)/page.tsx's dynamic export for why.
export const dynamic = "force-dynamic";

const DIRECTION_LABEL_DE: Record<string, string> = {
  higher_better: "höher ist besser",
  lower_better: "niedriger ist besser",
  non_monotonic: "nicht-monoton",
};

export default async function CriterionEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const criterion = await getCriterionDefinition(id);
  if (!criterion) notFound();

  const source = await getSource(criterion.sourceId);

  return (
    <main style={{ padding: "1.5rem", maxWidth: "40rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <IllustrativeBanner />
      <div>
        <Link href="/method">← Zur Methodenseite</Link>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0.25rem 0" }}>{criterion.nameDe}</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>{criterion.nameEn}</p>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "12rem 1fr", rowGap: "0.5rem", margin: 0 }}>
        <dt style={{ color: "var(--text-secondary)" }}>Richtung</dt>
        <dd style={{ margin: 0 }}>{DIRECTION_LABEL_DE[criterion.direction] ?? criterion.direction}</dd>

        <dt style={{ color: "var(--text-secondary)" }}>Gewichtung</dt>
        <dd className="tabular-nums" style={{ margin: 0 }}>
          {criterion.weight} — <em>illustrativ, noch nicht bestätigt (CLAUDE.md §3)</em>
        </dd>

        <dt style={{ color: "var(--text-secondary)" }}>Harte Ausschlusskriterium?</dt>
        <dd style={{ margin: 0 }}>{criterion.isHardConstraint ? "Ja (ADR-0004)" : "Nein"}</dd>

        <dt style={{ color: "var(--text-secondary)" }}>Gilt für</dt>
        <dd style={{ margin: 0 }}>{criterion.appliesTo.join(", ")}</dd>

        <dt style={{ color: "var(--text-secondary)" }}>Einheit</dt>
        <dd style={{ margin: 0 }}>{criterion.unit ?? "—"}</dd>

        <dt style={{ color: "var(--text-secondary)" }}>Methodenversion</dt>
        <dd className="tabular-nums" style={{ margin: 0 }}>{criterion.methodVersion}</dd>
      </dl>

      <section>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Quelle</h2>
        {source ? (
          <dl style={{ display: "grid", gridTemplateColumns: "12rem 1fr", rowGap: "0.5rem", margin: 0 }}>
            <dt style={{ color: "var(--text-secondary)" }}>Datensatz</dt>
            <dd style={{ margin: 0 }}>{source.dataset}</dd>

            <dt style={{ color: "var(--text-secondary)" }}>Herausgeber</dt>
            <dd style={{ margin: 0 }}>{source.publisher}</dd>

            <dt style={{ color: "var(--text-secondary)" }}>Lizenz</dt>
            <dd style={{ margin: 0 }}>{source.licence}</dd>

            <dt style={{ color: "var(--text-secondary)" }}>Abgerufen am</dt>
            <dd className="tabular-nums" style={{ margin: 0 }}>{source.retrievedAt ?? "—"}</dd>

            {source.url && (
              <>
                <dt style={{ color: "var(--text-secondary)" }}>URL</dt>
                <dd style={{ margin: 0, wordBreak: "break-all" }}>{source.url}</dd>
              </>
            )}
          </dl>
        ) : (
          <p style={{ color: "var(--text-secondary)" }}>Keine Quelle gefunden.</p>
        )}
      </section>
    </main>
  );
}
