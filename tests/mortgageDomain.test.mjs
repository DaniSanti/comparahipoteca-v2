import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFinancedAmount,
  calculateMortgage,
  calculateMonthlyPayment,
  calculatePurchaseCosts,
  getAnnualInterestRate,
} from "../src/domain/mortgageCalculations.ts";
import { validateMortgageInput } from "../src/domain/mortgageValidation.ts";

const fixedMortgage = {
  purchasePrice: 300_000,
  savings: 60_000,
  termYears: 25,
  type: "fixed",
  fixedTin: 3.5,
};

test("calculates a normal French-system monthly payment", () => {
  const payment = calculateMonthlyPayment(270_000, 3.5, 25);
  assert.ok(Math.abs(payment - 1_351.69) < 0.01);
});

test("calculates a zero-interest payment without dividing by zero", () => {
  assert.equal(calculateMonthlyPayment(240_000, 0, 20), 1_000);
});

test("uses the TIN for a fixed mortgage", () => {
  const result = calculateMortgage(fixedMortgage);
  assert.ok(result);
  assert.equal(getAnnualInterestRate(fixedMortgage), 3.5);
  assert.equal(result.annualInterestRate, 3.5);
  assert.ok(Math.abs(result.monthlyPayment - 1_351.69) < 0.01);
});

test("adds Euribor and differential for a variable mortgage", () => {
  const input = { ...fixedMortgage, type: "variable", fixedTin: undefined, euribor: 2.5, differential: 0.75 };
  const result = calculateMortgage(input);
  assert.ok(result);
  assert.equal(result.annualInterestRate, 3.25);
  assert.ok(result.monthlyPayment > 0);
});

test("calculates financed amount from purchase price, costs, and savings", () => {
  assert.equal(calculateFinancedAmount(300_000, 60_000, 30_000), 270_000);
  assert.equal(calculateFinancedAmount(100_000, 150_000, 10_000), 0);
});

test("estimates purchase costs at ten percent", () => {
  assert.equal(calculatePurchaseCosts(300_000), 30_000);
  assert.equal(calculatePurchaseCosts(Number.NaN), 0);
});

test("rejects invalid terms", () => {
  assert.equal(calculateMortgage({ ...fixedMortgage, termYears: 0 }), null);
  assert.equal(calculateMortgage({ ...fixedMortgage, termYears: 40.5 }), null);
  assert.equal(calculateMortgage({ ...fixedMortgage, termYears: 41 }), null);
});

test("rejects negative and non-finite inputs", () => {
  assert.ok(validateMortgageInput({ ...fixedMortgage, purchasePrice: -1 }).purchasePrice);
  assert.ok(validateMortgageInput({ ...fixedMortgage, savings: -1 }).savings);
  assert.ok(validateMortgageInput({ ...fixedMortgage, fixedTin: Number.NaN }).fixedTin);
  assert.equal(calculateMortgage({ ...fixedMortgage, purchasePrice: Number.POSITIVE_INFINITY }), null);
});

test("handles reasonable boundaries and a fully funded purchase", () => {
  const boundary = calculateMortgage({
    purchasePrice: 100_000_000,
    savings: 0,
    termYears: 40,
    type: "fixed",
    fixedTin: 25,
  });
  assert.ok(boundary);
  assert.ok(Object.values(boundary).every(Number.isFinite));

  const funded = calculateMortgage({ ...fixedMortgage, savings: 330_000 });
  assert.ok(funded);
  assert.equal(funded.financedAmount, 0);
  assert.equal(funded.monthlyPayment, 0);
  assert.equal(funded.totalInterest, 0);
  assert.equal(funded.totalCost, 330_000);
});

test("reports total interest and total cost consistently", () => {
  const result = calculateMortgage(fixedMortgage);
  assert.ok(result);
  assert.ok(Math.abs(result.totalInterest - (result.monthlyPayment * 300 - 270_000)) < 0.001);
  assert.ok(Math.abs(result.totalCost - (60_000 + 270_000 + result.totalInterest)) < 0.001);
});
