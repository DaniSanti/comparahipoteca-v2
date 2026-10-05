import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserAdapter, createGoogleAnalytics, DENIED_CONSENT, isValidMeasurementId } from "../src/analytics/googleAnalytics.ts";
import { ANALYTICS_EVENTS } from "../src/analytics/events.ts";
import { sanitizeAnalyticsUrl } from "../src/analytics/urlSanitization.ts";

const sensitiveUrl = "https://comparahipoteca.es/?sim=1,f,250000,60000,25,3.25";
const make = (overrides = {}) => {
  let consent = "undecided";
  let hostname = overrides.hostname ?? "comparahipoteca.es";
  const calls = [], scripts = [], disabled = [];
  const browser = {
    hostname: () => hostname, href: () => overrides.href ?? sensitiveUrl,
    command: (...args) => calls.push(args), appendScript: (...args) => scripts.push(args),
    disable: (...args) => disabled.push(args),
  };
  const ga = createGoogleAnalytics({ measurementId: "G-TEST123456", getConsent: () => consent, browser, ...overrides });
  return { ga, calls, scripts, disabled, setConsent: (value) => { consent = value; }, setHost: (value) => { hostname = value; } };
};
const events = (state) => state.calls.filter(([kind]) => kind === "event");

test("browser adapter uses the gtag queue format and never attaches a referrer to its script", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const scripts = [];
  globalThis.window = { location: new URL(sensitiveUrl) };
  globalThis.document = {
    getElementById: (id) => scripts.find((script) => script.id === id),
    createElement: () => ({}),
    head: { appendChild: (script) => scripts.push(script) },
  };
  try {
    const adapter = createBrowserAdapter();
    adapter.command("consent", "default", DENIED_CONSENT);
    assert.equal(Object.prototype.toString.call(window.dataLayer[0]), "[object Arguments]");
    assert.deepEqual(Array.from(window.dataLayer[0]), ["consent", "default", DENIED_CONSENT]);
    adapter.appendScript("comparahipoteca-ga", "https://www.googletagmanager.com/gtag/js?id=G-TEST123456");
    adapter.appendScript("comparahipoteca-ga", "duplicate");
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].referrerPolicy, "no-referrer");
    assert.equal(scripts[0].async, true);
    adapter.disable("G-TEST123456", true);
    assert.equal(window["ga-disable-G-TEST123456"], true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("validates the Measurement ID without requiring its presence", () => {
  assert.ok(isValidMeasurementId("G-TEST123456"));
  for (const value of [undefined, "", null, 1, "GTM-ABC123", "G-test123456", "G-TOOSHORT", "G-TEST123456<script>"]) {
    assert.equal(isValidMeasurementId(value), false);
  }
});

test("before consent only a local denied default is queued; no script or events", () => {
  const state = make();
  state.ga.initialise();
  state.ga.initialise();
  assert.deepEqual(state.calls, [["consent", "default", DENIED_CONSENT]]);
  assert.equal(state.scripts.length, 0);
  assert.equal(state.ga.trackEvent("comparison_added"), false);
  state.setConsent("rejected");
  state.ga.initialise();
  assert.equal(state.scripts.length, 0);
  assert.equal(events(state).length, 0);
});

test("accepting loads one script, configures once and sends one sanitized page view", () => {
  const state = make();
  state.ga.initialise();
  state.setConsent("accepted");
  state.ga.initialise();
  state.ga.initialise();
  assert.equal(state.scripts.length, 1);
  assert.match(state.scripts[0][1], /\/gtag\/js\?id=G-TEST123456$/);
  const configs = state.calls.filter(([kind]) => kind === "config");
  assert.equal(configs.length, 1);
  assert.deepEqual(configs[0][2], {
    page_location: "https://comparahipoteca.es/", page_referrer: "", page_title: "ComparaHipoteca",
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
  });
  assert.deepEqual(state.calls.find(([kind, action]) => kind === "consent" && action === "update")[2], { ...DENIED_CONSENT, analytics_storage: "granted" });
  assert.deepEqual(events(state), [["event", "page_view", {
    page_location: "https://comparahipoteca.es/", page_referrer: "", page_title: "ComparaHipoteca",
  }]]);
  assert.equal(state.ga.trackEvent("page_view"), false);
});

test("GA never loads or sends on localhost, preview, legacy hostname or other hosts", () => {
  for (const hostname of ["localhost", "127.0.0.1", "comparahipoteca-v2-git-preview.vercel.app", "comparahipoteca-v2.vercel.app", "www.comparahipoteca.es", "comparahipoteca.es.evil.invalid"]) {
    const state = make({ hostname });
    state.setConsent("accepted");
    state.ga.initialise();
    assert.equal(state.scripts.length, 0, hostname);
    assert.equal(state.ga.trackEvent("comparison_added"), false, hostname);
    assert.equal(events(state).length, 0, hostname);
  }
});

test("GA never loads with an absent or invalid ID; browserless initialization is safe", () => {
  for (const measurementId of [undefined, "", "not-a-measurement-id"]) {
    const state = make({ measurementId });
    state.setConsent("accepted");
    assert.doesNotThrow(() => state.ga.initialise());
    assert.equal(state.scripts.length, 0);
    assert.equal(state.ga.trackEvent("comparison_added"), false);
  }
  assert.doesNotThrow(() => createGoogleAnalytics({ measurementId: undefined, getConsent: () => "accepted" }).initialise());
});

test("URL sanitization removes sim, any query and hashes; rejects unusable URLs", () => {
  for (const value of [sensitiveUrl, "https://comparahipoteca.es/?anything=private", "https://comparahipoteca.es/#private", sensitiveUrl + "#private"]) {
    assert.equal(sanitizeAnalyticsUrl(value), "https://comparahipoteca.es/");
  }
  assert.equal(sanitizeAnalyticsUrl("https://comparahipoteca.es/path?value=private#hash"), "https://comparahipoteca.es/path");
  for (const value of ["invalid", "javascript:alert(1)", "data:text/plain,private"]) assert.equal(sanitizeAnalyticsUrl(value), null);
});

test("the exact shared URL and all financial data are absent from every sent payload", () => {
  const state = make();
  state.setConsent("accepted");
  state.ga.initialise();
  const financial = {
    price: 250000, savings: 60000, termYears: 25, tin: 3.25, euribor: 2.123456,
    differential: .75, monthlyPayment: 1234.56, financedAmount: 215000, costs: 25000,
    interest: 99318.97, total: 374318.97, sim: "1,f,250000,60000,25,3.25",
    snapshotId: "private-snapshot", url: sensitiveUrl, page_location: sensitiveUrl,
    page_referrer: sensitiveUrl, page_title: "Cuota 1234.56", label: "250000",
  };
  for (const name of ANALYTICS_EVENTS) state.ga.trackEvent(name, financial);
  const sent = JSON.stringify(state.calls);
  assert.ok(!sent.includes(sensitiveUrl));
  for (const secret of ["250000", "60000", "3.25", "2.123456", "1234.56", "215000", "99318.97", "374318.97", "private-snapshot", "sim="]) assert.ok(!sent.includes(secret), secret);
  for (const [, , payload] of events(state)) {
    assert.deepEqual(Object.keys(payload).sort(), ["page_location", "page_referrer", "page_title"]);
    assert.equal(payload.page_location, "https://comparahipoteca.es/");
    assert.equal(payload.page_referrer, "");
  }
});

test("only allowlisted events and share methods are accepted; all extra parameters are discarded", () => {
  const state = make();
  state.setConsent("accepted");
  state.ga.initialise();
  for (const method of ["native", "clipboard", "manual"]) {
    assert.equal(state.ga.trackEvent("simulation_shared", { method, url: sensitiveUrl }), true);
    assert.deepEqual(events(state).at(-1)[2], {
      page_location: "https://comparahipoteca.es/", page_referrer: "", page_title: "ComparaHipoteca", method,
    });
  }
  state.ga.trackEvent("comparison_added", { method: "native", amount: 250000 });
  assert.equal(events(state).at(-1)[2].method, undefined);
  state.ga.trackEvent("simulation_shared", { method: sensitiveUrl });
  assert.equal(events(state).at(-1)[2].method, undefined);
  for (const name of ["input_changed", "field_value", "form_submit", "scroll", "250000"]) assert.equal(state.ga.trackEvent(name, { value: 250000 }), false);
});

test("revocation sends denied consent, disables GA and prevents all later events", () => {
  const state = make();
  state.setConsent("accepted");
  state.ga.initialise();
  state.ga.revoke();
  assert.deepEqual(state.calls.at(-1), ["consent", "update", DENIED_CONSENT]);
  assert.deepEqual(state.disabled.at(-1), ["G-TEST123456", true]);
  assert.equal(state.ga.canTrack(), false);
  assert.equal(state.ga.trackEvent("comparison_removed"), false);
  state.setConsent("rejected");
  state.ga.initialise();
  assert.equal(state.scripts.length, 1);
});

test("shared_simulation_opened is sent once only for a valid shared simulation after consent", () => {
  const state = make();
  state.ga.sharedSimulationOpened(false);
  state.ga.initialise();
  state.ga.sharedSimulationOpened(true);
  assert.equal(events(state).length, 0);
  state.setConsent("accepted");
  state.ga.initialise();
  state.ga.sharedSimulationOpened(true);
  state.ga.initialise();
  assert.equal(events(state).filter(([, name]) => name === "shared_simulation_opened").length, 1);
  const invalid = make();
  invalid.ga.sharedSimulationOpened(false);
  invalid.setConsent("accepted");
  invalid.ga.initialise();
  assert.equal(events(invalid).filter(([, name]) => name === "shared_simulation_opened").length, 0);
});
