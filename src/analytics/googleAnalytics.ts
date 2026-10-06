import type { ConsentState } from "./consent.ts";
import { buildEventPayload, type AnalyticsEvent } from "./events.ts";
import { sanitizeAnalyticsUrl } from "./urlSanitization.ts";

export const PRODUCTION_HOSTNAME = "comparahipoteca.es";
export const DENIED_CONSENT = {
  analytics_storage: "denied", ad_storage: "denied",
  ad_user_data: "denied", ad_personalization: "denied",
} as const;
const GRANTED_CONSENT = { ...DENIED_CONSENT, analytics_storage: "granted" } as const;

export const isValidMeasurementId = (value: unknown): value is string =>
  typeof value === "string" && /^G-[A-Z0-9]{10}$/.test(value);

export interface AnalyticsBrowser {
  hostname(): string;
  href(): string;
  command(...args: unknown[]): void;
  appendScript(id: string, src: string): void;
  disable(id: string, disabled: boolean): void;
}

export function createGoogleAnalytics(options: {
  measurementId: unknown;
  getConsent: () => ConsentState;
  browser?: AnalyticsBrowser;
}) {
  const { browser, measurementId, getConsent } = options;
  let defaultsSent = false;
  let configured = false;
  let inserted = false;
  let revoked = false;
  let pageViewSent = false;
  let sharedOpened = false;
  let sharedEventSent = false;
  const eligible = () => Boolean(browser && isValidMeasurementId(measurementId)
    && browser.hostname() === PRODUCTION_HOSTNAME && getConsent() === "accepted" && !revoked);

  const trackEvent = (name: AnalyticsEvent, parameters: Record<string, unknown> = {}): boolean => {
    if (!eligible() || !configured || !browser) return false;
    if (name === "page_view" && pageViewSent) return false;
    const payload = buildEventPayload(name, parameters, browser.href());
    if (!payload) return false;
    browser.command("event", name, payload);
    if (name === "page_view") pageViewSent = true;
    return true;
  };

  const sendSharedOpened = () => {
    if (sharedOpened && !sharedEventSent) sharedEventSent = trackEvent("shared_simulation_opened");
  };

  return {
    canTrack: () => eligible() && configured,
    trackEvent,
    initialise() {
      if (!browser) return;
      if (!defaultsSent) {
        browser.command("consent", "default", DENIED_CONSENT);
        defaultsSent = true;
      }
      if (getConsent() === "accepted") revoked = false;
      if (!eligible() || !isValidMeasurementId(measurementId)) return;
      const location = sanitizeAnalyticsUrl(browser.href());
      if (!location) return;
      browser.disable(measurementId, false);
      if (!configured) {
        browser.command("consent", "update", GRANTED_CONSENT);
        browser.command("js", new Date());
        const context = { page_location: location, page_referrer: "", page_title: "ComparaHipoteca" };
        browser.command("set", context);
        browser.command("config", measurementId, {
          ...context,
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        });
        configured = true;
      }
      if (!pageViewSent) pageViewSent = trackEvent("page_view");
      sendSharedOpened();
      if (!inserted) {
        browser.appendScript("comparahipoteca-ga", `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
        inserted = true;
      }
    },
    sharedSimulationOpened(valid: boolean) {
      if (!valid) return;
      sharedOpened = true;
      sendSharedOpened();
    },
    revoke() {
      revoked = true;
      if (configured && browser && isValidMeasurementId(measurementId)) {
        browser.command("consent", "update", DENIED_CONSENT);
        browser.disable(measurementId, true);
      }
    },
  };
}

export function createBrowserAdapter(): AnalyticsBrowser | undefined {
  if (typeof window === "undefined") return undefined;
  const globals = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: string]: unknown;
  };
  return {
    hostname: () => window.location.hostname,
    href: () => window.location.href,
    command(...args) {
      globals.dataLayer ??= [];
      globals.gtag ??= function () {
        // gtag's documented queue format is an Arguments object.
        // eslint-disable-next-line prefer-rest-params
        globals.dataLayer!.push(arguments);
      };
      globals.gtag(...args);
    },
    appendScript(id, src) {
      if (document.getElementById(id)) return;
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.referrerPolicy = "no-referrer";
      document.head.appendChild(script);
    },
    disable(id, disabled) { globals[`ga-disable-${id}`] = disabled; },
  };
}
