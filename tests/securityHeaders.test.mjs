import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const configuration = JSON.parse(read("vercel.json"));
const rule = configuration.headers[0];
const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
const csp = headers["content-security-policy"];
const entries = csp.split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => entry.split(/\s+/));
const directives = Object.fromEntries(entries.map(([name, ...sources]) => [name, sources]));
const html = read("index.html");
const notFound = read("public/404.html");
const jsonLd = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
const hash = (body) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`;

test("vercel.json is valid and only configures response headers", () => {
  assert.deepEqual(Object.keys(configuration).sort(), ["$schema", "headers"]);
  assert.equal(configuration.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.equal(configuration.headers.length, 1);
  assert.deepEqual(Object.keys(rule).sort(), ["headers", "source"]);
  assert.equal(new Set(rule.headers.map((h) => h.key.toLowerCase())).size, rule.headers.length);
});

test("the documented catch-all header source covers root, missing paths and static assets", () => {
  assert.equal(rule.source, "/(.*)");
  const pattern = new RegExp(`^${rule.source}$`);
  for (const path of ["/", "/ruta-que-no-existe", "/nested/missing", "/404.html", "/404.css", "/assets/index-anyhash.js"]) {
    assert.match(path, pattern);
  }
});

test("CSP is enforced, has no duplicate directives and defaults to self", () => {
  assert.ok(csp);
  assert.equal(headers["content-security-policy-report-only"], undefined);
  assert.equal(new Set(entries.map(([name]) => name)).size, entries.length);
  assert.deepEqual(directives["default-src"], ["'self'"]);
});

test("MIME sniffing is disabled", () => assert.equal(headers["x-content-type-options"], "nosniff"));

test("referrer policy matches the existing privacy meta", () => {
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.match(html, /<meta name="referrer" content="no-referrer"/);
});

test("framing is denied by both CSP and legacy X-Frame-Options", () => {
  assert.equal(headers["x-frame-options"], "DENY");
  assert.deepEqual(directives["frame-ancestors"], ["'none'"]);
  assert.deepEqual(directives["frame-src"], ["'none'"]);
});

test("base injection, plugins and external form submission are restricted", () => {
  assert.deepEqual(directives["base-uri"], ["'none'"]);
  assert.deepEqual(directives["object-src"], ["'none'"]);
  assert.deepEqual(directives["form-action"], ["'self'"]);
});

test("permissions deny unused capabilities while retaining native sharing and clipboard", () => {
  const permissions = Object.fromEntries(headers["permissions-policy"].split(/,\s*/).map((entry) => entry.split("=")));
  assert.deepEqual(permissions, {
    camera: "()", microphone: "()", geolocation: "()", payment: "()", usb: "()", "web-share": "(self)",
  });
  assert.equal(permissions["clipboard-write"], undefined);
  assert.equal(permissions["clipboard-read"], undefined);
});

test("CSP contains no general wildcard or scheme-wide permission", () => {
  for (const sources of Object.values(directives)) {
    assert.equal(sources.includes("*"), false);
    assert.equal(sources.some((source) => /^[a-z]+:$/.test(source)), false);
  }
});

test("eval, inline scripts/styles and event handlers are not broadly authorised", () => {
  assert.doesNotMatch(csp, /'unsafe-eval'|'unsafe-inline'|'unsafe-hashes'/);
  assert.deepEqual(directives["script-src-attr"], ["'none'"]);
  assert.deepEqual(directives["style-src"], ["'self'"]);
  assert.deepEqual(directives["style-src-attr"], ["'none'"]);
});

test("Banco de España is permitted in connect-src, not script-src", () => {
  assert.ok(directives["connect-src"].includes("https://app.bde.es"));
  assert.equal(directives["script-src"].includes("https://app.bde.es"), false);
  assert.match(read("src/services/euribor.ts"), /https:\/\/app\.bde\.es\/bierest\//);
});

test("GA permissions match Google's no-Ads CSP guidance and the actual script host", () => {
  assert.deepEqual(directives["script-src"].filter((s) => s.startsWith("https://")), ["https://www.googletagmanager.com"]);
  assert.deepEqual(directives["img-src"], ["'self'", "https://www.googletagmanager.com", "https://*.google-analytics.com"]);
  assert.deepEqual(directives["connect-src"], [
    "'self'", "https://app.bde.es", "https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.google.com",
  ]);
  assert.match(read("src/analytics/googleAnalytics.ts"), /https:\/\/www\.googletagmanager\.com\/gtag\/js/);
});

test("Ads, remarketing and DoubleClick origins are not allowed", () => {
  assert.doesNotMatch(csp, /doubleclick|googleadservices|googlesyndication|googleads|remarketing/i);
});

test("same-origin metrics and own assets need no extra Vercel/CDN permission", () => {
  for (const name of ["script-src", "style-src", "connect-src", "img-src", "font-src", "manifest-src"]) {
    assert.ok(directives[name].includes("'self'"), name);
  }
  assert.doesNotMatch(csp, /vercel-scripts|vercel\.app|fonts\.googleapis/);
});

test("the sole allowed inline hash matches the exact JSON-LD bytes", () => {
  assert.equal(jsonLd.length, 1);
  assert.doesNotThrow(() => JSON.parse(jsonLd[0][1]));
  assert.deepEqual(directives["script-src"].filter((s) => s.startsWith("'sha256-")), [hash(jsonLd[0][1])]);
  assert.equal(directives["script-src"].includes(hash(jsonLd[0][1] + "\n")), false);
});

test("static HTML has no unauthorised inline scripts/styles or handlers", () => {
  const publicHtml = readdirSync(new URL("../public/", import.meta.url)).filter((name) => name.endsWith(".html"));
  for (const text of [html, ...publicHtml.map((name) => read(`public/${name}`))]) {
    assert.doesNotMatch(text, /<style\b|\sstyle\s*=|\son\w+\s*=|javascript:/i);
    for (const [, attributes, body] of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(attributes)) assert.equal(body.trim(), "");
      else assert.ok(directives["script-src"].includes(hash(body)), "Every inline script needs its own hash");
    }
  }
});

test("404 keeps noindex, the home link and a local external stylesheet", () => {
  assert.match(notFound, /<meta name="robots" content="noindex">/);
  assert.match(notFound, /<a href="\/">Volver a ComparaHipoteca<\/a>/);
  assert.match(notFound, /<link rel="stylesheet" href="\/404\.css">/);
  assert.match(read("public/404.css"), /a:focus-visible/);
});

test("routing, caching, HSTS and isolation headers are not overridden", () => {
  for (const key of ["rewrites", "redirects", "routes", "functions", "cleanUrls"]) assert.equal(configuration[key], undefined);
  for (const key of ["cache-control", "strict-transport-security", "cross-origin-embedder-policy", "cross-origin-opener-policy", "cross-origin-resource-policy"]) {
    assert.equal(headers[key], undefined);
  }
});
