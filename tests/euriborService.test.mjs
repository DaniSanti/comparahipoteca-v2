import assert from "node:assert/strict";
import test from "node:test";

import {
  EURIBOR_ENDPOINT,
  EuriborServiceError,
  parseEuriborResponse,
  requestLatestEuribor,
} from "../src/services/euribor.ts";
import { chooseEuriborValue } from "../src/features/simulator/euriborDefault.ts";

const validEntry = (overrides = {}) => ({
  serie: "D_1NBAF472",
  descripcionCorta: "Euríbor a un año",
  codFrecuencia: "M",
  fechaValor: "2026-09-01",
  valor: "2,123",
  ...overrides,
});

test("normalizes a valid monthly response with a decimal comma", () => {
  const result = parseEuriborResponse([validEntry()]);
  assert.equal(result.value, 2.123);
  assert.equal(result.date.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(result.source, "Banco de España");
  assert.equal(result.series, "D_1NBAF472");
});

test("accepts a finite numeric value and a valid date", () => {
  const result = parseEuriborResponse([validEntry({ valor: 1.75, fechaValor: "2025-12-31" })]);
  assert.equal(result.value, 1.75);
  assert.equal(result.date.getUTCFullYear(), 2025);
});

test("rejects an incorrect series and an empty array", () => {
  assert.throws(() => parseEuriborResponse([validEntry({ serie: "OTHER" })]), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([]), EuriborServiceError);
});

test("rejects malformed payloads, missing values, and non-monthly data", () => {
  assert.throws(() => parseEuriborResponse({ data: [] }), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([validEntry({ valor: undefined })]), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([validEntry({ codFrecuencia: "D" })]), EuriborServiceError);
});

test("rejects non-numeric, invalid-date, and out-of-range values", () => {
  assert.throws(() => parseEuriborResponse([validEntry({ valor: "actual" })]), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([validEntry({ fechaValor: "not-a-date" })]), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([validEntry({ fechaValor: "2026-02-31" })]), EuriborServiceError);
  assert.throws(() => parseEuriborResponse([validEntry({ valor: 25.01 })]), EuriborServiceError);
});

test("reports HTTP errors without trying to parse their body", async () => {
  const fetcher = async (url) => {
    assert.equal(url, EURIBOR_ENDPOINT);
    return new Response("unavailable", { status: 503 });
  };
  await assert.rejects(requestLatestEuribor(fetcher), /HTTP 503/);
});

test("aborts a request after the configured timeout", async () => {
  const fetcher = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  await assert.rejects(requestLatestEuribor(fetcher, 5), /tiempo de espera/);
});

test("does not replace Euribor restored from a shared variable simulation", () => {
  assert.equal(chooseEuriborValue({
    currentValue: "1.234567",
    officialValue: 2.5,
    isSharedVariable: true,
    wasManuallyEdited: false,
  }), "1.234567");
});

test("does not replace a value manually edited while the request was pending", () => {
  assert.equal(chooseEuriborValue({
    currentValue: "3,01",
    officialValue: 2.5,
    isSharedVariable: false,
    wasManuallyEdited: true,
  }), "3,01");
});
