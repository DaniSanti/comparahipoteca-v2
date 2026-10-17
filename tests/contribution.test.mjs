import assert from "node:assert/strict";
import test from "node:test";
import { contributionPercent, savingsFromPercent } from "../src/features/simulator/contribution.ts";

test("contribution percentage rounds only for display and keeps euros fixed when price changes", () => {
  assert.equal(contributionPercent("300000", "60000"), "20");
  assert.equal(contributionPercent("240000", "60000"), "25");
  assert.equal(contributionPercent("447700", "60000"), "13");
  assert.equal(savingsFromPercent("300000", "25"), "75000");
  assert.equal(savingsFromPercent("100,01", "33"), "33.0033");
});

test("percentage handles empty price, zero and 100 without accepting invalid percentages", () => {
  for (const price of ["", "0", "abc", "-1"]) assert.equal(contributionPercent(price, "60000"), "");
  assert.equal(contributionPercent("300000", "0"), "0");
  assert.equal(contributionPercent("300000", "300000"), "100");
  assert.equal(contributionPercent("300000", "300001"), "");
  for (const value of ["", "-1", "101", "2.5", "2,5", "1e1"]) assert.equal(savingsFromPercent("300000", value), "");
  assert.equal(savingsFromPercent("300000", "0"), "0");
  assert.equal(savingsFromPercent("300000", "100"), "300000");
});
