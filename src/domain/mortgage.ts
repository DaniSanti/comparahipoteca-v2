export type MortgageType = "fixed" | "variable";

export interface MortgageInput {
  purchasePrice: number;
  savings: number;
  termYears: number;
  type: MortgageType;
  fixedTin?: number;
  euribor?: number;
  differential?: number;
}

export interface MortgageCalculation {
  purchaseCosts: number;
  totalPurchasePrice: number;
  financedAmount: number;
  annualInterestRate: number;
  numberOfPayments: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
}

export const MORTGAGE_LIMITS = {
  purchasePrice: { min: 1, max: 100_000_000 },
  savings: { min: 0, max: 100_000_000 },
  termYears: { min: 1, max: 40 },
  fixedTin: { min: 0, max: 25 },
  euribor: { min: -5, max: 25 },
  differential: { min: 0, max: 15 },
} as const;

export const PURCHASE_COST_RATE = 0.1;
