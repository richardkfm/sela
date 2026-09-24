// CORINE Land Cover class names, verbatim from BKG's own product documentation
// shipped inside the CLC5 archive (clc5_2018.utm32s.shape/dokumentation/clc5_2018.pdf,
// read 2026-09-23). Only the classes that documentation lists for Germany appear.
// Display only — which class is how suitable is not decided here but in
// lib/scoring/illustrative-weights.ts, and is illustrative.

export const CLC_CLASS_NAME_DE: Readonly<Record<number, string>> = {
  111: "Durchgängig städtische Prägung",
  112: "Nicht durchgängig städtische Prägung",
  121: "Industrie und Gewerbeflächen, öffentliche Einrichtungen",
  122: "Straßen-, Eisenbahnnetze und funktionell zugeordnete Flächen",
  123: "Hafengebiete",
  124: "Flughäfen",
  131: "Abbauflächen",
  132: "Deponien und Abraumhalden",
  133: "Baustellen",
  141: "Städtische Grünflächen",
  142: "Sport- und Freizeitanlagen",
  211: "Nicht bewässertes Ackerland",
  221: "Weinbauflächen",
  222: "Obst- und Beerenobstbestände",
  231: "Wiesen und Weiden",
  242: "Komplexe Parzellenstruktur",
  243: "Landwirtschaftlich genutztes Land mit Flächen natürlicher Bodenbedeckung von signifikanter Größe",
  311: "Laubwälder",
  312: "Nadelwälder",
  313: "Mischwälder",
  321: "Natürliches Grünland",
  322: "Heiden und Moorheiden",
  324: "Wald-Strauch-Übergangsstadien",
  331: "Strände, Dünen und Sandflächen",
  332: "Felsen ohne Vegetation",
  333: "Flächen mit spärlicher Vegetation",
  334: "Brandflächen",
  335: "Gletscher und Dauerschneegebiete",
  411: "Sümpfe",
  412: "Torfmoore",
  421: "Salzwiesen",
  423: "In der Gezeitenzone liegende Flächen",
  511: "Gewässerläufe",
  512: "Wasserflächen",
  521: "Lagunen",
  522: "Mündungsgebiete",
  523: "Meere und Ozeane",
};

/** "211 · Nicht bewässertes Ackerland", or the bare code if it is not in the documented list. */
export function formatClcClass(code: number): string {
  const name = CLC_CLASS_NAME_DE[code];
  return name ? `${code} · ${name}` : String(code);
}
