import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateMortgage } from "../src/domain/mortgageCalculations.ts";
import { MortgageSimulator } from "../src/features/simulator/MortgageSimulator.tsx";
import { parseDecimalNumber, toMortgageInput, validateFormValues } from "../src/features/simulator/numberInput.ts";

const values = {
  purchasePrice: "250000", savings: "60000", termYears: "25",
  type: "fixed", fixedTin: "3.25", euribor: "2.123456", differential: "0.75",
};

test("converts comma and point decimals, including negative values", () => {
  for (const [text, expected] of [
    ["3.25", 3.25], ["3,25", 3.25], ["0,75", 0.75], ["-0,5", -0.5],
    ["0", 0], [" 3,25 ", 3.25], [",75", 0.75], [".75", 0.75], ["+0,5", 0.5],
  ]) {
    assert.equal(parseDecimalNumber(text), expected, text);
  }
});

const invalidValues = [
  "3,2,5", "3..25", "abc", "3,25.0", "3.25,0", "1.000,50", "1,000.50",
  "1 000", "3.25abc", "3%", "1e3", "0x10", "Infinity", "NaN",
  "", " ", "-", ",", ".", "3,", "3.", "9".repeat(400),
];

test("rejects malformed, grouped, non-finite and incomplete input without partial parsing", () => {
  for (const text of invalidValues) {
    assert.ok(Number.isNaN(parseDecimalNumber(text)), text);
  }
});

for (const [field, type] of [["fixedTin", "fixed"], ["euribor", "variable"], ["differential", "variable"]]) {
  test(`${field} accepts both decimal separators through form conversion and calculation`, () => {
    for (const [text, expected] of [["3.25", 3.25], ["3,25", 3.25], ["0,75", 0.75]]) {
      const current = Object.freeze({ ...values, type, [field]: text });
      const input = toMortgageInput(current);
      assert.equal(input[field], expected);
      assert.deepEqual(validateFormValues(current), {});
      assert.deepEqual(calculateMortgage(input), calculateMortgage({ ...input, [field]: expected }));
      assert.equal(current[field], text, "conversion must preserve the typed value");
    }
  });

  test(`${field} rejects ambiguous formats and prevents results`, () => {
    for (const text of invalidValues) {
      const current = { ...values, type, [field]: text };
      assert.ok(Number.isNaN(toMortgageInput(current)[field]), text);
      assert.ok(validateFormValues(current)[field], text);
      assert.equal(calculateMortgage(toMortgageInput(current)), null, text);
      if (text.trim()) assert.match(validateFormValues(current)[field], /coma o punto decimal/);
      else assert.match(validateFormValues(current)[field], /obligatorio/);
    }
  });

  test(`${field} parses -0,5 while preserving its existing domain limits`, () => {
    const current = { ...values, type, [field]: "-0,5" };
    assert.equal(toMortgageInput(current)[field], -0.5);
    const errors = validateFormValues(current);
    if (field === "euribor") {
      assert.deepEqual(errors, {});
      assert.ok(calculateMortgage(toMortgageInput(current)));
    } else {
      assert.match(errors[field], /menor que 0/);
      assert.equal(calculateMortgage(toMortgageInput(current)), null);
    }
  });
}

test("price and savings accept decimal amounts with comma or point without mutating values", () => {
  const current = Object.freeze({ ...values, purchasePrice: "250000,50", savings: "60000.75" });
  const input = toMortgageInput(current);
  assert.equal(input.purchasePrice, 250000.5);
  assert.equal(input.savings, 60000.75);
  assert.deepEqual(validateFormValues(current), {});
  assert.ok(calculateMortgage(input));
  assert.equal(current.purchasePrice, "250000,50");
  assert.equal(current.savings, "60000.75");
});

test("inactive mortgage rate fields do not generate errors", () => {
  assert.deepEqual(validateFormValues({ ...values, euribor: "abc", differential: "3..25" }), {});
  assert.deepEqual(validateFormValues({ ...values, type: "variable", fixedTin: "3,2,5" }), {});
});

test("term still requires whole years and preserves its domain bounds", () => {
  assert.deepEqual(validateFormValues({ ...values, termYears: "40" }), {});
  assert.match(validateFormValues({ ...values, termYears: "25.5" }).termYears, /años completos/);
  assert.match(validateFormValues({ ...values, termYears: "41" }).termYears, /mayor que 40/);
});

test("decimal controls expose text inputs and decimal keyboards while term retains integer input", () => {
  const html = renderToStaticMarkup(createElement(MortgageSimulator));
  for (const id of ["purchasePrice", "savings", "fixedTin"]) {
    assert.match(html, new RegExp(`id="${id}" name="${id}" type="text" inputMode="decimal"`, "i"));
    assert.match(html, new RegExp(`aria-describedby="${id}-unit decimal-format"`));
  }
  assert.match(html, /id="termYears" name="termYears" type="number" inputMode="numeric" step="1"/i);
  assert.match(html, /id="decimal-format"/);
});
