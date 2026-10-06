import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Fixed byte limits, based on main at 0fc76b2. See docs/performance.md.
export const BUNDLE_BUDGETS = Object.freeze({
  jsRaw: 210_000,
  jsGzip: 68_000,
  jsChunkGzip: 68_000,
  cssRaw: 12_000,
  cssGzip: 3_400,
});

export function measureBundle(assetsDirectory) {
  let entries;
  try {
    entries = readdirSync(assetsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`No se encuentra ${assetsDirectory}. Ejecuta primero npm run build.`);
    }
    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const data = readFileSync(join(assetsDirectory, name));
      return { name, raw: data.length, gzip: gzipSync(data, { level: 9 }).length };
    });

  const summarise = (extension) => {
    const category = files.filter((file) => file.name.endsWith(extension));
    if (category.length === 0) {
      throw new Error(`No hay assets ${extension} en ${assetsDirectory}. Ejecuta primero npm run build.`);
    }
    return {
      files: category,
      raw: category.reduce((total, file) => total + file.raw, 0),
      // Compress separately, as each asset is an independent HTTP response.
      gzip: category.reduce((total, file) => total + file.gzip, 0),
    };
  };

  const js = summarise(".js");
  const css = summarise(".css");
  const largest = (metric) => js.files.reduce((max, file) => file[metric] > max[metric] ? file : max);
  return { js, css, largestJsRaw: largest("raw"), largestJsGzip: largest("gzip") };
}

export function findBudgetViolations(bundle, budgets = BUNDLE_BUDGETS) {
  const metrics = [
    { metric: "JavaScript total raw", actual: bundle.js.raw, limit: budgets.jsRaw },
    { metric: "JavaScript total gzip", actual: bundle.js.gzip, limit: budgets.jsGzip },
    { metric: "JavaScript max chunk gzip", actual: bundle.largestJsGzip.gzip, limit: budgets.jsChunkGzip },
    { metric: "CSS total raw", actual: bundle.css.raw, limit: budgets.cssRaw },
    { metric: "CSS total gzip", actual: bundle.css.gzip, limit: budgets.cssGzip },
  ];
  return metrics
    .filter(({ actual, limit }) => actual > limit)
    .map((metric) => ({ ...metric, overage: metric.actual - metric.limit }));
}

const kb = (bytes) => `${(bytes / 1_000).toFixed(2)} KB`;

export function formatBundleReport(bundle, budgets = BUNDLE_BUDGETS) {
  const violations = findBudgetViolations(bundle, budgets);
  const lines = [
    "Bundle budget (1 KB = 1000 bytes; gzip level 9)",
    "",
    `JavaScript (${bundle.js.files.length} assets)`,
    `  raw:       ${kb(bundle.js.raw)} / ${kb(budgets.jsRaw)}`,
    `  gzip:      ${kb(bundle.js.gzip)} / ${kb(budgets.jsGzip)}`,
    `  max chunk: ${kb(bundle.largestJsGzip.gzip)} / ${kb(budgets.jsChunkGzip)} gzip (${bundle.largestJsGzip.name})`,
    `  max raw:   ${kb(bundle.largestJsRaw.raw)} (${bundle.largestJsRaw.name})`,
    "",
    `CSS (${bundle.css.files.length} assets)`,
    `  raw:       ${kb(bundle.css.raw)} / ${kb(budgets.cssRaw)}`,
    `  gzip:      ${kb(bundle.css.gzip)} / ${kb(budgets.cssGzip)}`,
    "",
  ];
  for (const { metric, actual, limit, overage } of violations) {
    lines.push(`✗ ${metric}: ${kb(actual)} (${actual} bytes) > ${kb(limit)} (${limit} bytes); +${kb(overage)} (${overage} bytes)`);
  }
  lines.push(violations.length ? "✗ Bundle exceeds budget" : "✓ Bundle within budget");
  return lines.join("\n");
}
