// An outcome method as ADR-0008 §4 records it: named, versioned, cited, with
// every factor it uses. The definitions in this directory are the single
// source of those factors — the materialiser writes them to `outcome_method`
// from here, so the method page cannot print a number the code does not use.

import type { OutcomeDimension } from "../types";

/** One published factor, with where it was read. */
export interface CitedFactor {
  readonly value: number;
  /** The published 95 % interval, where there is one. */
  readonly low?: number;
  readonly high?: number;
  readonly unit: string;
  /** Table and printed page, e.g. "IPCC 2013 Wetlands Supplement, Table 2.1, p. 2.12". */
  readonly citation: string;
}

/** How one metric of a method is named and read on screen. */
export interface OutcomeMetricInfo {
  readonly metric: string;
  readonly labelDe: string;
  readonly unit: string;
  /** The one-line reason shown with *trifft nicht zu* (ADR-0008 §3), for metrics that can be not_applicable. */
  readonly notApplicableDe?: string;
  /** What this metric's range means (ADR-0008 §2), for metrics that carry one. */
  readonly rangeDe?: string;
}

export interface OutcomeMethod {
  readonly methodVersion: string;
  readonly dimension: OutcomeDimension;
  readonly nameDe: string;
  readonly nameEn: string;
  readonly citation: string;
  readonly descriptionDe: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  /** Every metric the method writes, in display order. */
  readonly metrics: readonly OutcomeMetricInfo[];
}

/** A value and the range the method attaches to it (ADR-0008 §2). */
export interface Span {
  readonly value: number;
  readonly low: number;
  readonly high: number;
}

export function scaleSpan(span: Span, factor: number): Span {
  return { value: span.value * factor, low: span.low * factor, high: span.high * factor };
}

export function addSpans(...spans: readonly Span[]): Span {
  return spans.reduce(
    (sum, s) => ({ value: sum.value + s.value, low: sum.low + s.low, high: sum.high + s.high }),
    { value: 0, low: 0, high: 0 },
  );
}

/** A factor as a span; a factor with no published interval spans only itself. */
export function factorSpan(factor: CitedFactor): Span {
  return { value: factor.value, low: factor.low ?? factor.value, high: factor.high ?? factor.value };
}
