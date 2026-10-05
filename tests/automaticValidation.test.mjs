import assert from "node:assert/strict";
import test from "node:test";
import { calculateMortgage } from "../src/domain/mortgageCalculations.ts";
import { validateMortgageInput } from "../src/domain/mortgageValidation.ts";
import { getCalculationIssue, getVisibleErrors } from "../src/features/simulator/formValidation.ts";

const input = {
  purchasePrice: 250000, savings: 60000, termYears: 25,
  type: "fixed", fixedTin: 3.25,
};

test("untouched invalid fields hide inline errors but block misleading results", () => {
  const invalid = { ...input, purchasePrice: NaN, termYears: 0 };
  const errors = validateMortgageInput(invalid);
  assert.deepEqual(getVisibleErrors(errors, {}), {});
  assert.equal(calculateMortgage(invalid), null);
  assert.equal(getCalculationIssue(errors), "El precio es obligatorio.");
});

test("blur reveals only that field and corrections immediately clear its error", () => {
  const touched = { termYears: true };
  const errors = validateMortgageInput({ ...input, termYears: 2.5, savings: -1 });
  assert.deepEqual(getVisibleErrors(errors, touched), {
    termYears: "El plazo debe indicarse en años completos.",
  });
  const corrected = validateMortgageInput({ ...input, savings: -1 });
  assert.deepEqual(getVisibleErrors(corrected, touched), {});
  assert.equal(getCalculationIssue(corrected), "El ahorro no puede ser menor que 0.");
  assert.equal(getCalculationIssue(validateMortgageInput(input)), "");
});

test("switching mortgage type only reports active domain fields", () => {
  const touched = { fixedTin: true, euribor: true, differential: true };
  const variable = { ...input, type: "variable", fixedTin: NaN, euribor: NaN, differential: 0.75 };
  assert.deepEqual(getVisibleErrors(validateMortgageInput(variable), touched), {
    euribor: "El Euríbor es obligatorio.",
  });
  const fixed = { ...variable, type: "fixed", fixedTin: 3.25 };
  assert.deepEqual(getVisibleErrors(validateMortgageInput(fixed), touched), {});
  assert.ok(calculateMortgage(fixed));
});

test("automatic validation preserves domain boundaries and zero values", () => {
  const valid = { ...input, savings: 0, fixedTin: 0, termYears: 40 };
  assert.deepEqual(validateMortgageInput(valid), {});
  assert.ok(calculateMortgage(valid));
  const invalid = { ...valid, termYears: 41 };
  assert.equal(getCalculationIssue(validateMortgageInput(invalid)), "El plazo no puede ser mayor que 40.");
  assert.equal(calculateMortgage(invalid), null);
});
