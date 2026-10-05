import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CONSENT_KEY, clearGaCookies, createConsentStore } from "../src/analytics/consent.ts";
import { createPrivacyController } from "../src/analytics/privacyController.ts";
import { ConsentMetrics } from "../src/analytics/ConsentMetrics.tsx";
import { PrivacyControls } from "../src/features/privacy/PrivacyControls.tsx";
import { sanitizeSpeedInsightsEvent, consentStore } from "../src/analytics/runtime.ts";
import { getFocusScrollDistance } from "../src/features/privacy/focusVisibility.ts";

test("keyboard focus scrolls only when a control overlaps the banner", () => {
  const banner = { top: 558, bottom: 832, left: 12, right: 308 };
  assert.equal(getFocusScrollDistance({ top: 529, bottom: 577, left: 29, right: 291 }, banner), 31);
  assert.equal(getFocusScrollDistance({ top: 703, bottom: 751, left: 29, right: 291 }, banner), 205);
  assert.equal(getFocusScrollDistance({ top: 444, bottom: 492, left: 29, right: 291 }, banner), 0);
  assert.equal(getFocusScrollDistance({ top: 703, bottom: 751, left: 400, right: 600 }, banner), 0);
});

const memoryStorage = (initial) => {
  const items = new Map(initial ? [[CONSENT_KEY, initial]] : []);
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
};

test("first visit is undecided; accepting and rejecting persist only the versioned privacy key", () => {
  const storage = memoryStorage();
  const store = createConsentStore(() => storage);
  assert.equal(store.getSnapshot(), "undecided");
  store.set("accepted");
  assert.equal(store.getSnapshot(), "accepted");
  assert.equal(createConsentStore(() => storage).getSnapshot(), "accepted");
  store.set("rejected");
  assert.equal(createConsentStore(() => storage).getSnapshot(), "rejected");
  assert.deepEqual([...storage.items], [[CONSENT_KEY, "rejected"]]);
});

test("invalid or old preferences never imply consent", () => {
  for (const value of ["true", "ACCEPTED", "unknown", '{"accepted":true}']) {
    assert.equal(createConsentStore(() => memoryStorage(value)).getSnapshot(), "undecided");
  }
});

test("storage access, reads and writes can fail without preventing a session-only choice", () => {
  for (const getStorage of [
    () => { throw new Error("Storage blocked"); },
    () => ({ getItem() { throw new Error("Read blocked"); }, setItem() { throw new Error("Write blocked"); } }),
    () => undefined,
  ]) {
    const store = createConsentStore(getStorage);
    assert.equal(store.getSnapshot(), "undecided");
    store.set("accepted");
    assert.equal(store.getSnapshot(), "accepted");
    store.set("rejected");
    assert.equal(store.getSnapshot(), "rejected");
    assert.equal(createConsentStore(getStorage).getSnapshot(), "undecided");
  }
});

test("revocation denies analytics, clears GA cookies, saves rejection and reloads in order", () => {
  const steps = [];
  const storage = memoryStorage("accepted");
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => { steps.push("save:" + value); originalSet(key, value); };
  const store = createConsentStore(() => storage);
  const controller = createPrivacyController({
    store,
    analytics: { revoke: () => steps.push("denied"), initialise: () => steps.push("initialise") },
    clearCookies: () => steps.push("cookies"), reload: () => steps.push("reload"),
  });
  controller.changeConsent("rejected");
  assert.deepEqual(steps, ["denied", "cookies", "save:rejected", "reload"]);
  assert.equal(store.getSnapshot(), "rejected");
  assert.equal(createConsentStore(() => storage).getSnapshot(), "rejected");
  steps.length = 0;
  controller.changeConsent("accepted");
  assert.deepEqual(steps, ["save:accepted", "initialise"]);
});

test("a rejected first choice needs no reload; revocation still reloads if persistence fails", () => {
  let reloads = 0;
  const store = createConsentStore(() => { throw new Error("Blocked"); });
  const controller = createPrivacyController({
    store, analytics: { revoke() {}, initialise() {} }, clearCookies() {}, reload() { reloads++; },
  });
  controller.changeConsent("rejected");
  assert.equal(reloads, 0);
  controller.changeConsent("accepted");
  controller.changeConsent("rejected");
  assert.equal(reloads, 1);
  assert.equal(store.getSnapshot(), "rejected");
});

test("withdrawal in another tab immediately denies tracking and reloads this tab", () => {
  const storage = memoryStorage("accepted");
  const store = createConsentStore(() => storage);
  const steps = [];
  const controller = createPrivacyController({
    store, analytics: { revoke() { steps.push("revoke"); }, initialise() {} },
    clearCookies() { steps.push("clear"); }, reload() { steps.push("reload"); },
  });
  storage.setItem(CONSENT_KEY, "rejected");
  controller.synchroniseStoredPreference();
  assert.equal(store.getSnapshot(), "rejected");
  assert.deepEqual(steps, ["revoke", "clear", "reload"]);
});

test("cookie cleanup expires only _ga and _ga_* across current domain and paths", () => {
  const assignments = [];
  const jar = {
    get cookie() { return "_ga=one; _ga_TEST=two; _ga_TEST-OLD=three; _gat=keep; _gaOther=keep; essential=keep"; },
    set cookie(value) { assignments.push(value); },
  };
  clearGaCookies(jar, "comparahipoteca.es", "/tools/compare");
  assert.deepEqual([...new Set(assignments.map((item) => item.split("=")[0]))], ["_ga", "_ga_TEST", "_ga_TEST-OLD"]);
  assert.ok(assignments.some((value) => value.includes("Domain=.comparahipoteca.es")));
  assert.ok(assignments.some((value) => value.includes("Path=/tools")));
  assert.ok(assignments.every((value) => value.includes("Max-Age=0")));
  assert.doesNotThrow(() => clearGaCookies({ get cookie() { throw new Error("Denied"); } }, "comparahipoteca.es", "/"));
});

test("Speed Insights component is mounted only with accepted consent", () => {
  let mounts = 0;
  const Component = () => { mounts++; return createElement("span", null, "metrics"); };
  for (const consent of ["undecided", "rejected"]) {
    assert.equal(renderToStaticMarkup(createElement(ConsentMetrics, { consent, Component })), "");
  }
  assert.equal(mounts, 0);
  assert.match(renderToStaticMarkup(createElement(ConsentMetrics, { consent: "accepted", Component })), /metrics/);
  assert.equal(mounts, 1);
});

test("Speed Insights middleware denies rejected events and strips all queries, hashes and unknown fields", () => {
  const event = { type: "vital", url: "https://comparahipoteca.es/?sim=1,f,250000,60000,25,3.25#private", route: "?sim=private", financial: 250000 };
  consentStore.set("rejected");
  assert.equal(sanitizeSpeedInsightsEvent(event), null);
  consentStore.set("accepted");
  assert.deepEqual(sanitizeSpeedInsightsEvent(event), { type: "vital", url: "https://comparahipoteca.es/", route: "/" });
  assert.equal(sanitizeSpeedInsightsEvent({ ...event, url: "invalid" }), null);
  consentStore.set("rejected");
});

test("banner exposes equally available accept and reject actions and permanent preferences", () => {
  const html = renderToStaticMarkup(createElement(PrivacyControls, { consent: "undecided" }));
  assert.match(html, /aria-labelledby="privacy-title"/);
  assert.match(html, /Aceptar analíticas/);
  assert.match(html, />Rechazar<\/button>/);
  assert.match(html, /<details/);
  assert.match(html, /Preferencias de privacidad/);
  assert.doesNotMatch(html, /aria-modal|role="dialog"|checked/);
  for (const consent of ["accepted", "rejected"]) {
    const saved = renderToStaticMarkup(createElement(PrivacyControls, { consent }));
    assert.doesNotMatch(saved, /class="consent-banner"/);
    assert.match(saved, /Preferencias de privacidad/);
  }
});
