import { resolve } from "node:path";
import { findBudgetViolations, formatBundleReport, measureBundle } from "./bundle-budget.mjs";

try {
  const bundle = measureBundle(resolve("dist/assets"));
  console.log(formatBundleReport(bundle));
  if (findBudgetViolations(bundle).length > 0) process.exitCode = 1;
} catch (error) {
  console.error(`✗ Bundle budget: ${error.message}`);
  process.exitCode = 1;
}
