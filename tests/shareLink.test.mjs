import assert from "node:assert/strict";
import test from "node:test";
import { shareLink } from "../src/features/sharing/shareLink.ts";

const url = "https://comparahipoteca.es/?sim=unchanged";
const title = "Hipoteca 2 · ComparaHipoteca";

test("prefers native sharing and identifies the mortgage", async () => {
  const calls = [];
  const outcome = await shareLink(url, title, {
    share: async (data) => { calls.push(data); },
    copy: async () => { assert.fail("should not copy after native success"); },
  });
  assert.equal(outcome, "shared");
  assert.deepEqual(calls, [{ title, url }]);
});

test("copies the exact URL when native share is absent or fails", async () => {
  for (const share of [undefined, async () => { throw new Error("Unavailable"); }]) {
    const calls = [];
    assert.equal(await shareLink(url, title, {
      share,
      copy: async (link) => { calls.push(link); },
    }), "copied");
    assert.deepEqual(calls, [url]);
  }
});

test("native cancellation does not silently copy or report an error", async () => {
  assert.equal(await shareLink(url, title, {
    share: async () => { throw new DOMException("Cancelled", "AbortError"); },
    copy: async () => { assert.fail("cancelled share must not copy"); },
  }), "cancelled");
});

test("exposes the manual fallback if no capability succeeds", async () => {
  assert.equal(await shareLink(url, title, {}), "manual");
  assert.equal(await shareLink(url, title, {
    share: async () => { throw new Error("Native failed"); },
    copy: async () => { throw new Error("Clipboard denied"); },
  }), "manual");
  assert.equal(await shareLink(url, title, {
    copy: async () => { throw new Error("Clipboard denied"); },
  }), "manual");
});
