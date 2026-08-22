import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "sela",
  description:
    "Spatial decision-support for land-use trade-offs — comparing what is built, what is preserved, and what is restored.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Public-facing interface language is German (design-language.md §9);
  // this Phase 1 skeleton has no rendered copy yet to localise.
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
