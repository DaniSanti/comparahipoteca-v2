import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { parseSharedSimulation, serializeSharedSimulation } from "../src/features/sharing/sharedSimulation.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const canonical = "https://comparahipoteca.es/";
const title = "Simulador de hipoteca y comparador | ComparaHipoteca";
const description = "Calcula una hipoteca fija o variable, consulta el Euríbor oficial y compara hasta 5 escenarios de forma sencilla para el mercado español.";
const tags = (text, name) => [...text.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [key, value])));
const meta = (key, value) => {
  const matches = tags(html, "meta").filter((tag) => tag.name === key || tag.property === key);
  assert.equal(matches.length, 1, key);
  assert.equal(matches[0].content, value, key);
};

test("one static canonical, Spanish language, descriptive title and description", () => {
  assert.deepEqual(tags(html, "link").filter((tag) => tag.rel === "canonical"), [{ rel: "canonical", href: canonical }]);
  assert.equal(tags(html, "html")[0].lang, "es");
  assert.deepEqual([...html.matchAll(/<title>([^<]*)<\/title>/g)].map(([, value]) => value), [title]);
  meta("description", description);
  assert.equal(tags(html, "meta").some((tag) => tag.name?.toLowerCase() === "keywords"), false);
  assert.doesNotMatch(html, /noindex/i);
});

test("Open Graph and basic Twitter card share coherent metadata", () => {
  for (const [key, value] of Object.entries({ "og:title": title, "og:description": description, "og:type": "website", "og:url": canonical, "og:site_name": "ComparaHipoteca", "og:locale": "es_ES", "twitter:card": "summary", "twitter:title": title, "twitter:description": description })) meta(key, value);
  assert.equal(tags(html, "meta").some((tag) => ["og:image", "twitter:image", "twitter:site", "twitter:creator"].includes(tag.name ?? tag.property)), false);
});

test("JSON-LD is valid and describes the free web application", () => {
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.deepEqual(JSON.parse(scripts[0][1]), {
    "@context": "https://schema.org", "@type": "WebApplication", name: "ComparaHipoteca", url: canonical,
    description, applicationCategory: "FinanceApplication", operatingSystem: "Any", inLanguage: "es-ES",
    isAccessibleForFree: true, browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  });
});

test("sitemap is a complete standard XML document containing only the canonical", () => {
  const xml = read("public/sitemap.xml");
  // Validate the entire intentionally minimal XML grammar, including namespace and balanced tags.
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\s*<url>\s*<loc>https:\/\/comparahipoteca\.es\/<\/loc>\s*<\/url>\s*<\/urlset>\s*$/);
  assert.deepEqual([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, url]) => url), [canonical]);
  assert.doesNotMatch(xml, /sim=|lastmod|vercel\.app|www\.comparahipoteca|localhost/i);
});

test("robots allows crawling including simulation queries and advertises sitemap", () => {
  assert.equal(read("public/robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${canonical}sitemap.xml\n`);
});

test("public SEO files never refer to the old deployment domain", () => {
  for (const text of [html, ...readdirSync(new URL("../public/", import.meta.url)).filter((file) => /\.(txt|xml|html|json)$/.test(file)).map((file) => read(`public/${file}`))]) {
    assert.doesNotMatch(text, /comparahipoteca-v2\.vercel\.app/i);
  }
});

test("canonical-domain shared simulations retain the v1 format and query", () => {
  for (const input of [
    { purchasePrice: 250000, savings: 55000, termYears: 30, type: "fixed", fixedTin: 2.85 },
    { purchasePrice: 310000, savings: 80000, termYears: 25, type: "variable", euribor: 2.123456, differential: 0.7 },
  ]) {
    const url = new URL(serializeSharedSimulation(input, canonical));
    const before = url.href;
    assert.equal(url.origin + url.pathname, canonical);
    assert.match(url.searchParams.get("sim"), /^1,[fv],/);
    assert.deepEqual(parseSharedSimulation(url.href), input);
    assert.equal(url.href, before);
    assert.equal(tags(html, "link").find((tag) => tag.rel === "canonical").href, canonical);
  }
});
