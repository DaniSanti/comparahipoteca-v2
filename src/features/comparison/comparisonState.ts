import type {
  MortgageCalculation,
  MortgageInput,
  MortgageType,
} from "../../domain/mortgage.ts";

export const MAX_COMPARISONS = 5;

export interface MortgageSnapshot {
  readonly id: string;
  readonly purchasePrice: number;
  readonly savings: number;
  readonly termYears: number;
  readonly type: MortgageType;
  readonly fixedTin?: number;
  readonly euribor?: number;
  readonly differential?: number;
  readonly appliedTin: number;
  readonly financedAmount: number;
  readonly monthlyPayment: number;
  readonly purchaseCosts: number;
  readonly totalInterest: number;
  readonly totalCost: number;
}

const fallbackId = (): string =>
  `mortgage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const createComparisonId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? fallbackId();

export const createMortgageSnapshot = (
  input: MortgageInput,
  result: MortgageCalculation,
  id = createComparisonId(),
): MortgageSnapshot =>
  Object.freeze({
    id,
    purchasePrice: input.purchasePrice,
    savings: input.savings,
    termYears: input.termYears,
    type: input.type,
    ...(input.type === "fixed"
      ? { fixedTin: input.fixedTin }
      : { euribor: input.euribor, differential: input.differential }),
    appliedTin: result.annualInterestRate,
    financedAmount: result.financedAmount,
    monthlyPayment: result.monthlyPayment,
    purchaseCosts: result.purchaseCosts,
    totalInterest: result.totalInterest,
    totalCost: result.totalCost,
  });

export const addSimulation = (
  simulations: readonly MortgageSnapshot[],
  simulation: MortgageSnapshot,
): readonly MortgageSnapshot[] =>
  simulations.length >= MAX_COMPARISONS ? simulations : [...simulations, simulation];

export const removeSimulation = (
  simulations: readonly MortgageSnapshot[],
  id: string,
): readonly MortgageSnapshot[] =>
  simulations.filter((simulation) => simulation.id !== id);
