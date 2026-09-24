// How a criterion's measured value is written in the interface — with its
// unit, in German number format, and never more precise than its source
// (design-language.md §5, §8: "no false precision"). A 1 km irradiation grid
// is shown to the kWh, a 200 m slope to a tenth of a degree, a land-cover
// class by its documented name, a share as whole percent.

import { formatClcClass } from "./clc-classes";

const INTEGER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const TWO_DECIMALS = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCriterionValue(criterionId: string, value: number, unit: string | null): string {
  if (criterionId === "pv_land_cover") return formatClcClass(Math.round(value));
  switch (unit) {
    case "Flächenanteil":
      return `${INTEGER.format(value * 100)} % der Fläche`;
    case "kWh/m²·a":
      return `${INTEGER.format(value)} kWh/m²·a`;
    case "°":
      return `${ONE_DECIMAL.format(value)}°`;
    default:
      return unit ? `${TWO_DECIMALS.format(value)} ${unit}` : TWO_DECIMALS.format(value);
  }
}
