"use client";

import { ReportFlow } from "./report-flow";

/**
 * The marriage report — the original product. The whole flow (birth form,
 * teaser, checkout, print-to-PDF doc, chat hand-off) now lives in ReportFlow so
 * career & money and baby & child share one engine; this wrapper keeps the
 * existing /report page and its import unchanged.
 */
export function MarriageReport() {
  return <ReportFlow type="marriage" />;
}
