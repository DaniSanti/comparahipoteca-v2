import assert from "node:assert/strict";
import test from "node:test";

import { parseSharedSimulation, serializeSharedSimulation } from "../src/features/sharing/sharedSimulation.ts";

const fixed = { purchasePrice: 250_000, savings: 55_000, termYears: 30, type: "fixed", fixedTin: 2.85 };
const variable = { purchasePrice: 310_000, savings: 80_000, termYears: 25, type: "variable", euribor: 2.123456, differential: 0.7 };

test("serializes only the reproducible fixed-rate inputs in version 1", () => {
  const url = new URL(serializeSharedSimulation(fixed, "https://example.test/calculadora?old=value#section"));
  assert.equal(url.pathname, "/calculadora");
  assert.equal(url.searchParams.get("sim"), "1,f,250000,55000,30,2.85");
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, "");
});

test("serializes variable inputs and preserves the exact Euribor", () => {
  const url = serializeSharedSimulation(variable, "https://example.test/");
  assert.match(new URL(url).searchParams.get("sim"), /^1,v,/);
  assert.equal(parseSharedSimulation(url).euribor, 2.123456);
});

test("round-trips fixed and variable simulations", () => {
  assert.deepEqual(parseSharedSimulation(serializeSharedSimulation(fixed, "https://example.test")), fixed);
  assert.deepEqual(parseSharedSimulation(serializeSharedSimulation(variable, "https://example.test")), variable);
});

test("rejects manipulated and non-finite payloads", () => {
  assert.equal(parseSharedSimulation("?sim=1,x,250000,50000,25,3"), null);
  assert.equal(parseSharedSimulation("?sim=1,f,250000,50000,25,NaN"), null);
  assert.equal(parseSharedSimulation("?sim=1,f,250000,50000,25,3,unexpected"), null);
});

test("rejects values outside domain limits", () => {
  assert.equal(parseSharedSimulation("?sim=1,f,100000001,50000,25,3"), null);
  assert.equal(parseSharedSimulation("?sim=1,v,250000,50000,41,2,1"), null);
  assert.equal(parseSharedSimulation("?sim=1,v,250000,50000,25,-6,1"), null);
});

test("rejects unknown versions and incomplete URLs", () => {
  assert.equal(parseSharedSimulation("?sim=2,f,250000,50000,25,3"), null);
  assert.equal(parseSharedSimulation("?sim=1,f,250000,50000,25"), null);
  assert.equal(parseSharedSimulation("https://example.test/"), null);
});
