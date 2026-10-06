import { SpeedInsights } from "@vercel/speed-insights/react";
import { shouldMountSpeedInsights, type ConsentState } from "./consent";
import { sanitizeSpeedInsightsEvent } from "./runtime";

export function ConsentMetrics({
  consent,
  Component = SpeedInsights,
}: { consent: ConsentState; Component?: typeof SpeedInsights }) {
  return shouldMountSpeedInsights(consent)
    ? <Component beforeSend={sanitizeSpeedInsightsEvent} route="/" />
    : null;
}
