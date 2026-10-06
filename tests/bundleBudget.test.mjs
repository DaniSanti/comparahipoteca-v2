import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
  BUNDLE_BUDGETS,
  findBudgetViolations,
  formatBundleReport,
  measureBundle,
} from "../scripts/bundle-budget.mjs";

function fixture(t, assets = { "index-a1b2.js": "console.log('test');", "index-c3d4.css": "body{color:red}" }) {
  const directory = mkdtempSync(join(tmpdir(), "bundle-budget-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [name, data] of Object.entries(assets)) {
    const path = join(directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }
  return directory;
}

test("bundle within budget passes and reports actual raw and per-file gzip bytes", (t) => {
  const bundle = measureBundle(fixture(t));
  assert.equal(bundle.js.raw, Buffer.byteLength("console.log('test');"));
  assert.equal(bundle.js.gzip, gzipSync("console.log('test');", { level: 9 }).length);
  assert.equal(bundle.css.gzip, gzipSync("body{color:red}", { level: 9 }).length);
  assert.deepEqual(findBudgetViolations(bundle), []);
  assert.match(formatBundleReport(bundle), /✓ Bundle within budget/);
});

test("total JS gzip fails even when all individual chunks fit", (t) => {
  const bundle = measureBundle(fixture(t, {
    "first-abc.js": "console.log('first');",
    "second-def.js": "console.log('second');",
    "style-123.css": "body{color:red}",
  }));
  const budgets = { ...BUNDLE_BUDGETS, jsGzip: bundle.js.gzip - 1, jsChunkGzip: bundle.largestJsGzip.gzip };
  assert.equal(bundle.js.gzip, bundle.js.files.reduce((sum, file) => sum + file.gzip, 0));
  const violations = findBudgetViolations(bundle, budgets);
  assert.deepEqual(violations, [{ metric: "JavaScript total gzip", actual: bundle.js.gzip, limit: budgets.jsGzip, overage: 1 }]);
  assert.match(formatBundleReport(bundle, budgets), /JavaScript total gzip:.*bytes.*\+.*\(1 bytes\)/);
});

test("an individual JS gzip chunk fails while its total fits", (t) => {
  const bundle = measureBundle(fixture(t));
  const budgets = { ...BUNDLE_BUDGETS, jsChunkGzip: bundle.largestJsGzip.gzip - 1 };
  assert.deepEqual(findBudgetViolations(bundle, budgets).map((v) => v.metric), ["JavaScript max chunk gzip"]);
});

test("CSS gzip totals fail across multiple assets", (t) => {
  const bundle = measureBundle(fixture(t, {
    "main-abc.js": "console.log('test');",
    "main-123.css": "body{color:red}",
    "extra-456.css": "h1{color:blue}",
  }));
  const budgets = { ...BUNDLE_BUDGETS, cssGzip: bundle.css.gzip - 1 };
  assert.deepEqual(findBudgetViolations(bundle, budgets).map((v) => v.metric), ["CSS total gzip"]);
});

test("raw JS and CSS totals fail independently of compression", (t) => {
  const bundle = measureBundle(fixture(t));
  const budgets = { ...BUNDLE_BUDGETS, jsRaw: bundle.js.raw - 1, cssRaw: bundle.css.raw - 1 };
  assert.deepEqual(findBudgetViolations(bundle, budgets).map((v) => v.metric), ["JavaScript total raw", "CSS total raw"]);
});

test("hashed names and chunk counts can change without affecting measurements", (t) => {
  const one = measureBundle(fixture(t, { "index-deadbeef.js": "const a=1;", "style-ABC.css": "a{}" }));
  const two = measureBundle(fixture(t, { "other-XYZ987.js": "const a=1;", "renamed-789.css": "a{}" }));
  assert.equal(one.js.raw, two.js.raw);
  assert.equal(one.js.gzip, two.js.gzip);
  assert.equal(one.css.raw, two.css.raw);
  assert.equal(one.css.gzip, two.css.gzip);
  assert.equal(two.largestJsGzip.name, "other-XYZ987.js");
});

test("source maps, non-assets and directories with asset extensions are ignored", (t) => {
  const expected = measureBundle(fixture(t));
  const directory = fixture(t, {
    "index-a1b2.js": "console.log('test');",
    "index-c3d4.css": "body{color:red}",
    "index-a1b2.js.map": "x".repeat(100_000),
    "index-c3d4.css.map": "x".repeat(100_000),
    "index.html": "x".repeat(100_000),
    "favicon.png": "x".repeat(100_000),
  });
  mkdirSync(join(directory, "ignored.js"));
  mkdirSync(join(directory, "ignored.css"));
  const actual = measureBundle(directory);
  assert.deepEqual(actual, expected);
});

test("exact budget boundaries pass", (t) => {
  const bundle = measureBundle(fixture(t));
  assert.deepEqual(findBudgetViolations(bundle, {
    jsRaw: bundle.js.raw, jsGzip: bundle.js.gzip, jsChunkGzip: bundle.largestJsGzip.gzip,
    cssRaw: bundle.css.raw, cssGzip: bundle.css.gzip,
  }), []);
});

test("largest raw and gzip chunks are selected independently", (t) => {
  const noisy = Array.from({ length: 100 }, (_, i) => `console.log(${i},'value-${i * 7919}');`).join("\n");
  const bundle = measureBundle(fixture(t, {
    "large-raw.js": "a".repeat(10_000), "large-gzip.js": noisy, "style.css": "a{}",
  }));
  assert.equal(bundle.largestJsRaw.name, "large-raw.js");
  assert.equal(bundle.largestJsGzip.name, "large-gzip.js");
});

test("missing or incomplete assets fail with build instructions", (t) => {
  const directory = fixture(t, {});
  assert.throws(() => measureBundle(join(directory, "missing")), /Ejecuta primero npm run build/);
  assert.throws(() => measureBundle(directory), /No hay assets \.js/);
  writeFileSync(join(directory, "main.js"), "const a=1;");
  assert.throws(() => measureBundle(directory), /No hay assets \.css/);
});

test("CLI exits nonzero when dist is missing", (t) => {
  const result = spawnSync(process.execPath, [new URL("../scripts/check-bundle-budget.mjs", import.meta.url).pathname], {
    cwd: fixture(t, {}), encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm run build/);
});

test("CLI succeeds for a valid build", (t) => {
  const result = spawnSync(process.execPath, [new URL("../scripts/check-bundle-budget.mjs", import.meta.url).pathname], {
    cwd: fixture(t, { "dist/assets/app-hash.js": "const a=1;", "dist/assets/app-hash.css": "a{}" }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ Bundle within budget/);
});

test("CLI exits nonzero and reports the actual value, limit and excess", (t) => {
  const result = spawnSync(process.execPath, [new URL("../scripts/check-bundle-budget.mjs", import.meta.url).pathname], {
    cwd: fixture(t, {
      "dist/assets/app-hash.js": "a".repeat(BUNDLE_BUDGETS.jsRaw + 1),
      "dist/assets/app-hash.css": "a{}",
    }),
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /JavaScript total raw:.*210001 bytes.*210000 bytes.*1 bytes/);
  assert.match(result.stdout, /✗ Bundle exceeds budget/);
});
