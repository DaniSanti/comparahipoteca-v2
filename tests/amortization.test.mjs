import assert from "node:assert/strict";
import test from "node:test";
import { calculateMortgage } from "../src/domain/mortgageCalculations.ts";
import { monthlyAmortization, annualAmortization } from "../src/domain/amortization.ts";
import { amortizationCsv, amortizationPdf } from "../src/features/amortization/exportAmortization.ts";

const input = { purchasePrice: 300000, savings: 60000, termYears: 25, type: "fixed", fixedTin: 3.5 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} != ${expected}`);

for (const scenario of [input, { ...input, fixedTin: 0 }, { ...input, termYears: 40, fixedTin: 25 }, { ...input, type: "variable", euribor: -1, differential: 0 }]) {
  test(`schedule reconciles principal, payments and interest: ${scenario.type} ${scenario.fixedTin} ${scenario.euribor}`, () => {
    const result = calculateMortgage(scenario);
    const rows = monthlyAmortization(result);
    assert.equal(rows.length, scenario.termYears * 12);
    close(rows[0].interest, result.financedAmount * result.annualInterestRate / 1200);
    close(rows[0].payment, result.monthlyPayment);
    assert.equal(rows.at(-1).remaining, 0);
    assert.equal(rows.at(-1).repaid, result.financedAmount);
    close(rows.reduce((sum, row) => sum + row.principal, 0), result.financedAmount);
    close(rows.reduce((sum, row) => sum + row.payment, 0), result.monthlyPayment * rows.length);
    if (result.annualInterestRate >= 0) close(rows.reduce((sum, row) => sum + row.interest, 0), result.totalInterest);
    for (const [index, row] of rows.entries()) {
      assert.ok(Object.values(row).every(Number.isFinite));
      assert.ok(row.remaining >= 0);
      close(row.payment, row.principal + row.interest);
      close(row.remaining + row.repaid, result.financedAmount);
      if (index) assert.ok(row.remaining <= rows[index - 1].remaining);
    }
  });
}

test("annual amounts sum 12 months and balances use the final month", () => {
  const months = monthlyAmortization(calculateMortgage(input));
  const years = annualAmortization(months);
  assert.equal(years.length, 25);
  for (const [index, row] of years.entries()) {
    const group = months.slice(index * 12, (index + 1) * 12);
    for (const field of ["payment", "principal", "interest"]) close(row[field], group.reduce((sum, month) => sum + month[field], 0));
    assert.equal(row.repaid, group.at(-1).repaid);
    assert.equal(row.remaining, group.at(-1).remaining);
    assert.equal(row.month, undefined);
  }
});

test("no financing has no repayments", () => {
  assert.deepEqual(monthlyAmortization(calculateMortgage({ ...input, savings: 330000 })), []);
});

test("CSV contains every selected period, accented headers and spreadsheet-friendly decimals", () => {
  const months = monthlyAmortization(calculateMortgage(input));
  const csv = amortizationCsv(months, "monthly");
  assert.ok(csv.startsWith("\uFEFFAño / mes;Cuota mensual;Amortización;Intereses;Capital amortizado;Capital pendiente"));
  assert.equal(csv.trim().split("\r\n").length, 301);
  assert.ok(csv.includes("Año 25 / mes 12;"));
  assert.ok(csv.endsWith(";270000,00;0,00\r\n"));
  assert.equal(amortizationCsv(annualAmortization(months), "annual").trim().split("\r\n").length, 26);
});

test("PDF paginates all 480 months with correct byte offsets and stream lengths", () => {
  const result = calculateMortgage({ ...input, termYears: 40 });
  const rows = monthlyAmortization(result);
  const pdf = Buffer.from(amortizationPdf(rows, "monthly", result, true)).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf, /\/Count 19/);
  assert.ok(pdf.includes("Año 40 / mes 12"));
  assert.ok(pdf.includes("TIN actual constante"));
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), "xref");
  const entries = pdf.slice(xref).split("\n").slice(3).filter((line) => /^\d{10} 00000 n/.test(line));
  entries.forEach((entry, index) => assert.ok(pdf.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj`)));
  for (const match of pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g)) assert.equal(match[2].length, Number(match[1]));
});
