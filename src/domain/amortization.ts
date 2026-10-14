import type { MortgageCalculation } from "./mortgage";

export type AmortizationPeriod = "annual" | "monthly";
export interface AmortizationRow {
  year: number;
  month?: number;
  payment: number;
  principal: number;
  interest: number;
  repaid: number;
  remaining: number;
}

// Keep calculation precision; round only for display, as in the simulator.
export function monthlyAmortization(result: MortgageCalculation): AmortizationRow[] {
  if (result.financedAmount <= 0) return [];
  const rows: AmortizationRow[] = [];
  let remaining = result.financedAmount;
  const rate = result.annualInterestRate / 1200;
  for (let index = 0; index < result.numberOfPayments; index++) {
    const interest = remaining * rate;
    const principal = index === result.numberOfPayments - 1
      ? remaining
      : Math.min(remaining, result.monthlyPayment - interest);
    remaining = Math.max(0, remaining - principal);
    rows.push({
      year: Math.floor(index / 12) + 1,
      month: index % 12 + 1,
      payment: principal + interest,
      principal,
      interest,
      repaid: result.financedAmount - remaining,
      remaining,
    });
  }
  return rows;
}

export function annualAmortization(months: readonly AmortizationRow[]): AmortizationRow[] {
  const years: AmortizationRow[] = [];
  for (const row of months) {
    let year = years.at(-1);
    if (!year || year.year !== row.year) {
      year = { year: row.year, payment: 0, principal: 0, interest: 0, repaid: 0, remaining: 0 };
      years.push(year);
    }
    year.payment += row.payment;
    year.principal += row.principal;
    year.interest += row.interest;
    year.repaid = row.repaid;
    year.remaining = row.remaining;
  }
  return years;
}
