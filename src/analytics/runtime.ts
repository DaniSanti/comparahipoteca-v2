import { CONSENT_KEY, clearGaCookies, createConsentStore } from "./consent.ts";
import { createBrowserAdapter, createGoogleAnalytics } from "./googleAnalytics.ts";
import { sanitizeAnalyticsUrl } from "./urlSanitization.ts";
import type { BeforeSendMiddleware } from "@vercel/speed-insights";
import { createPrivacyController } from "./privacyController.ts";

export const consentStore = createConsentStore(() =>
  typeof window === "undefined" ? undefined : window.localStorage);
export const analytics = createGoogleAnalytics({
  measurementId: import.meta.env?.VITE_GA_MEASUREMENT_ID,
  getConsent: consentStore.getSnapshot,
  browser: createBrowserAdapter(),
});
export const trackEvent = analytics.trackEvent;

const clearCookies = () => {
  if (typeof document !== "undefined") clearGaCookies(document, window.location.hostname, window.location.pathname);
};

const controller = createPrivacyController({
  store: consentStore,
  analytics,
  clearCookies,
  reload: () => { if (typeof window !== "undefined") window.location.reload(); },
});
export const changeAnalyticsConsent = controller.changeConsent;

let started = false;
export function initialisePrivacy() {
  if (started) return;
  started = true;
  analytics.initialise();
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    if (event.key !== CONSENT_KEY && event.key !== null) return;
    controller.synchroniseStoredPreference();
  });
}

export const sanitizeSpeedInsightsEvent: BeforeSendMiddleware = (event) => {
  if (consentStore.getSnapshot() !== "accepted") return null;
  const url = sanitizeAnalyticsUrl(event.url);
  if (!url) return null;
  // Route is fixed because this application has a single public page.
  return { type: "vital", url, route: "/" };
};
