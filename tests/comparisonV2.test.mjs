import assert from "node:assert/strict";
import test from "node:test";

import { calculateMortgage } from "../src/domain/mortgageCalculations.ts";
import { addSimulation, createMortgageSnapshot, removeSimulation } from "../src/features/comparison/comparisonState.ts";

const input = { purchasePrice: 300_000, savings: 60_000, termYears: 25, type: "fixed", fixedTin: 3.5 };
const makeSnapshot = (id, overrides = {}) => {
  const nextInput = { ...input, ...overrides };
  return createMortgageSnapshot(nextInput, calculateMortgage(nextInput), id);
};

test("adds and removes a simulation without mutating the existing collection", () => {
  const first = makeSnapshot("one");
  const initial = [];
  const added = addSimulation(initial, first);
  const removed = removeSimulation(added, "one");

  assert.deepEqual(initial, []);
  assert.equal(added[0], first);
  assert.deepEqual(removed, []);
  assert.equal(added.length, 1);
});

test("keeps at most five simulations and does not discard an existing one", () => {
  let simulations = [];
  for (let index = 1; index <= 5; index += 1) simulations = addSimulation(simulations, makeSnapshot(String(index)));
  const fullCollection = simulations;
  const result = addSimulation(simulations, makeSnapshot("six"));

  assert.equal(result, fullCollection);
  assert.deepEqual(result.map(({ id }) => id), ["1", "2", "3", "4", "5"]);
});

test("creates independent immutable snapshots of simulator values", () => {
  const mutableInput = { ...input };
  const first = createMortgageSnapshot(mutableInput, calculateMortgage(mutableInput), "first");
  mutableInput.purchasePrice = 450_000;
  const second = createMortgageSnapshot(mutableInput, calculateMortgage(mutableInput), "second");

  assert.equal(first.purchasePrice, 300_000);
  assert.equal(second.purchasePrice, 450_000);
  assert.ok(Object.isFrozen(first));
  assert.throws(() => { first.purchasePrice = 1; }, TypeError);
});

test("preserves the exact Euribor in a variable snapshot", () => {
  const variable = { purchasePrice: 280_000, savings: 70_000, termYears: 30, type: "variable", euribor: 2.123456, differential: 0.65 };
  const snapshot = createMortgageSnapshot(variable, calculateMortgage(variable), "variable");
  assert.equal(snapshot.euribor, 2.123456);
  assert.equal(snapshot.appliedTin, 2.773456);
});

test("removing from a full comparison allows another snapshot without losing the others", () => {
  const full = Array.from({ length: 5 }, (_, index) => makeSnapshot(String(index)));
  const removed = removeSimulation(full, "2");
  const replacement = makeSnapshot("replacement");
  const added = addSimulation(removed, replacement);
  assert.deepEqual(added.map(({ id }) => id), ["0", "1", "3", "4", "replacement"]);
  assert.equal(full.length, 5);
  assert.equal(added[0], full[0]);
});
