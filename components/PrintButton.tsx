"use client";

// Opens the browser's print dialog (mvp.md F5, printable comparison). Hidden
// in print itself.

export function PrintButton() {
  return (
    <button type="button" className="btn btn-small no-print" onClick={() => window.print()}>
      Drucken
    </button>
  );
}
