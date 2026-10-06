import { sanitizeAnalyticsUrl } from "./urlSanitization.ts";

export const ANALYTICS_EVENTS = [
  "page_view", "mortgage_calculated", "comparison_added", "comparison_removed",
  "simulation_shared", "shared_simulation_opened",
] as const;
export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number];
export type ShareMethod = "native" | "clipboard" | "manual";

// No spread of caller parameters: unknown keys and values never enter the payload.
export function buildEventPayload(name: string, parameters: Record<string, unknown>, href: string) {
  if (!(ANALYTICS_EVENTS as readonly string[]).includes(name)) return null;
  const location = sanitizeAnalyticsUrl(href);
  if (!location) return null;
  const payload: Record<string, string> = {
    page_location: location,
    page_referrer: "",
    page_title: "ComparaHipoteca",
  };
  const method = parameters.method;
  if (name === "simulation_shared" && typeof method === "string" && ["native", "clipboard", "manual"].includes(method)) {
    payload.method = method;
  }
  return payload;
}
