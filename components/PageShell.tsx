// The frame every screen below the map shares (roadmap-planning-tool.md
// Phase 3; design-language.md §3): the wordmark, where the reader is — Land ›
// Landkreis › Gemeinde › this page — and the way back to the map at the same
// place, then the page's own title and lead. One shell, so the parcel page,
// the comparisons, the evidence and the method read as one publication, and
// so "back to the map" always carries the region and the selected cell
// (lib/explorer-url.ts) instead of dropping the reader on the default region.

import Link from "next/link";
import type { ReactNode } from "react";
import { getRegionSummary } from "@/lib/db/queries/regions";
import { pilotRegionInfo } from "@/lib/pilot-region";

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * The crumbs for a cell's region: its Land, its Landkreis (as region rows,
 * when loaded) and its Gemeinde, each a link into the explorer at that
 * scope. The cell itself (`unitId`) is passed on so the map reopens on it.
 */
export async function regionCrumbs(
  pilotRegion: string,
  options: { readonly municipality?: { readonly ags: string; readonly name: string } | null; readonly unitId?: string } = {},
): Promise<Crumb[]> {
  const info = pilotRegionInfo(pilotRegion);
  const u = options.unitId ? `&u=${options.unitId}` : "";
  const crumbs: Crumb[] = [];
  if (info.kind === "fixture") {
    crumbs.push({ label: info.nameDe, href: `/?region=${pilotRegion}${u}` });
    return crumbs;
  }
  const region = await getRegionSummary(pilotRegion);
  if (region?.parent) crumbs.push({ label: region.parent.nameDe, href: `/?region=${region.parent.id}` });
  else if (info.land && info.level === "kreis") crumbs.push({ label: info.land.nameDe });
  crumbs.push({
    label: region ? (region.level === "land" ? region.nameDe : `${region.bez ?? "Landkreis"} ${region.nameDe}`) : info.nameDe,
    href: `/?region=${pilotRegion}${u}`,
  });
  // A cell's Landkreis within a Land grid, when the cell carries one (ADR-0012).
  if (region?.level === "land" && options.municipality) {
    const kreis = region.children.find((c) => c.ags && options.municipality!.ags.startsWith(c.ags));
    if (kreis) crumbs.push({ label: `${kreis.bez ?? "Landkreis"} ${kreis.nameDe}`, href: `/?region=${kreis.id}${u}` });
  }
  if (options.municipality) crumbs.push({ label: options.municipality.name });
  return crumbs;
}

export function PageShell({
  crumbs,
  current,
  title,
  lead,
  wide = false,
  actions,
  children,
}: {
  /** Where this page sits; the last crumb with an href is "back to the map". */
  crumbs: readonly Crumb[];
  /** This page's own name in the trail, e.g. "Begründung". */
  current: string;
  title: ReactNode;
  lead?: ReactNode;
  wide?: boolean;
  /** Controls beside the title (print, export); left off the printed page. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const back = [...crumbs].reverse().find((c) => c.href);
  return (
    <main className={`page-shell${wide ? " page-shell-wide" : ""}`}>
      <header className="page-header">
        <nav aria-label="Sie sind hier" className="page-crumbs">
          <Link href="/" className="wordmark">
            sela
          </Link>
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`}>
              <span aria-hidden> › </span>
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            </span>
          ))}
          <span>
            <span aria-hidden> › </span>
            <span aria-current="page">{current}</span>
          </span>
        </nav>
        {back && (
          <Link href={back.href!} className="no-print">
            ← Zur Karte
          </Link>
        )}
      </header>
      <div>
        <h1 className="page-title">{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
        {actions && (
          <div className="explorer-views no-print" style={{ marginTop: "0.6rem" }}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </main>
  );
}
