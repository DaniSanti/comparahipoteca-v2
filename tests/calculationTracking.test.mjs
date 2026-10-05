import assert from "node:assert/strict";
import test from "node:test";
import { createCalculationTracker } from "../src/analytics/calculationTracking.ts";

const input = { purchasePrice: 250000, savings: 60000, termYears: 25, type: "fixed", fixedTin: 3.25 };
const setup = () => {
  let now = 0, sequence = 0, accepted = true;
  const timers = new Map(), sent = [];
  const tracker = createCalculationTracker({
    canTrack: () => accepted,
    emit: () => { sent.push("mortgage_calculated"); return true; },
    schedule: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    cancel: (id) => timers.delete(id),
  });
  return { tracker, sent, setAccepted: (value) => { accepted = value; }, advance(ms) {
    now += ms;
    for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  } };
};

test("default and shared initial values produce no mortgage_calculated event", () => {
  const state = setup();
  state.tracker.observe(input, true, false);
  state.advance(10000);
  assert.deepEqual(state.sent, []);
});

test("user edits debounce at 900 ms, resetting on each modification", () => {
  const state = setup();
  state.tracker.observe(input, true, true);
  state.advance(750);
  assert.equal(state.sent.length, 0);
  state.tracker.observe({ ...input, fixedTin: 4 }, true, true);
  state.advance(899);
  assert.equal(state.sent.length, 0);
  state.advance(1);
  assert.deepEqual(state.sent, ["mortgage_calculated"]);
});

test("same scenario deduplicates locally while a different scenario emits again", () => {
  const state = setup();
  state.tracker.observe(input, true, true); state.advance(900);
  state.tracker.observe({ ...input }, true, true); state.advance(900);
  assert.equal(state.sent.length, 1);
  state.tracker.observe({ ...input, fixedTin: 4 }, true, true); state.advance(900);
  state.tracker.observe(input, true, true); state.advance(900);
  assert.equal(state.sent.length, 2);
  assert.ok(state.sent.every((value) => value === "mortgage_calculated"));
});

test("invalid results cancel pending calculation events", () => {
  const state = setup();
  state.tracker.observe(input, true, true);
  state.advance(500);
  state.tracker.observe({ ...input, fixedTin: NaN }, false, true);
  state.advance(1000);
  assert.deepEqual(state.sent, []);
});

test("rejection, revocation and unmount prevent pending events; no pre-consent backlog", () => {
  const state = setup();
  state.setAccepted(false);
  state.tracker.observe(input, true, true); state.advance(1000);
  state.setAccepted(true); state.advance(1000);
  assert.equal(state.sent.length, 0);
  state.tracker.observe(input, true, true);
  state.setAccepted(false); state.advance(1000);
  assert.equal(state.sent.length, 0);
  state.setAccepted(true);
  state.tracker.observe(input, true, true);
  state.tracker.stop(); state.advance(1000);
  assert.equal(state.sent.length, 0);
  state.tracker.observe(input, true, true); state.advance(900);
  assert.equal(state.sent.length, 1);
});
