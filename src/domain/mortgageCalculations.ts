import {
  PURCHASE_COST_RATE,
  type MortgageCalculation,
  type MortgageInput,
} from "./mortgage.ts";
import { validateMortgageInput } from "./mortgageValidation.ts";

export const calculatePurchaseCosts = (purchasePrice: number): number => {
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) return 0;
  return purchasePrice * PURCHASE_COST_RATE;
};

export const calculateFinancedAmount = (
  purchasePrice: number,
  savings: number,
  purchaseCosts = calculatePurchaseCosts(purchasePrice),
): number => {
  if (![purchasePrice, savings, purchaseCosts].every(Number.isFinite)) return 0;
  if (purchasePrice < 0 || savings < 0 || purchaseCosts < 0) return 0;
  return Math.max(0, purchasePrice + purchaseCosts - savings);
};

export const getAnnualInterestRate = (input: MortgageInput): number =>
  input.type === "fixed"
    ? (input.fixedTin ?? Number.NaN)
    : (input.euribor ?? Number.NaN) + (input.differential ?? Number.NaN);

export const calculateMonthlyPayment = (
  principal: number,
  annualInterestRate: number,
  termYears: number,
): number => {
  if (![principal, annualInterestRate, termYears].every(Number.isFinite)) return 0;
  if (principal <= 0 || termYears <= 0 || !Number.isInteger(termYears)) return 0;

  const numberOfPayments = termYears * 12;
  const monthlyRate = annualInterestRate / 100 / 12;
  if (monthlyRate === 0) return principal / numberOfPayments;
  if (monthlyRate <= -1) return 0;

  const divisor = 1 - (1 + monthlyRate) ** -numberOfPayments;
  const payment = principal * monthlyRate / divisor;
  return Number.isFinite(payment) && payment >= 0 ? payment : 0;
};

export const calculateMortgage = (input: MortgageInput): MortgageCalculation | null => {
  if (Object.keys(validateMortgageInput(input)).length > 0) return null;

  const purchaseCosts = calculatePurchaseCosts(input.purchasePrice);
  const totalPurchasePrice = input.purchasePrice + purchaseCosts;
  const financedAmount = calculateFinancedAmount(input.purchasePrice, input.savings, purchaseCosts);
  const annualInterestRate = getAnnualInterestRate(input);
  const numberOfPayments = input.termYears * 12;
  const monthlyPayment = calculateMonthlyPayment(financedAmount, annualInterestRate, input.termYears);
  const totalInterest = Math.max(0, monthlyPayment * numberOfPayments - financedAmount);

  return {
    purchaseCosts,
    totalPurchasePrice,
    financedAmount,
    annualInterestRate,
    numberOfPayments,
    monthlyPayment,
    totalInterest,
    totalCost: Math.min(input.savings, totalPurchasePrice) + financedAmount + totalInterest,
  };
};
