import type { MortgageInput, MortgageType } from "../../domain/mortgage.ts";
import {
  validateMortgageInput,
  type MortgageField,
  type MortgageValidationErrors,
} from "../../domain/mortgageValidation.ts";

export interface FormValues {
  purchasePrice: string;
  savings: string;
  termYears: string;
  type: MortgageType;
  fixedTin: string;
  euribor: string;
  differential: string;
}

// One decimal separator, no grouping, exponents or partial numeric matches.
// Keep the original string in the form; normalize only at this boundary.
export const parseDecimalNumber = (value: string): number => {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(trimmed)) {
    return Number.NaN;
  }
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const toMortgageInput = (values: FormValues): MortgageInput => ({
  purchasePrice: parseDecimalNumber(values.purchasePrice),
  savings: parseDecimalNumber(values.savings),
  termYears: parseDecimalNumber(values.termYears),
  type: values.type,
  fixedTin: values.type === "fixed" ? parseDecimalNumber(values.fixedTin) : undefined,
  euribor: values.type === "variable" ? parseDecimalNumber(values.euribor) : undefined,
  differential:
    values.type === "variable" ? parseDecimalNumber(values.differential) : undefined,
});

export const validateFormValues = (values: FormValues): MortgageValidationErrors => {
  const errors = validateMortgageInput(toMortgageInput(values));
  const activeFields: MortgageField[] = [
    "purchasePrice",
    "savings",
    "termYears",
    ...(values.type === "fixed"
      ? ["fixedTin" as const]
      : ["euribor" as const, "differential" as const]),
  ];
  for (const field of activeFields) {
    if (values[field].trim() && !Number.isFinite(parseDecimalNumber(values[field]))) {
      errors[field] = field === "termYears"
        ? "Introduce el plazo en años completos."
        : "Introduce un número con una sola coma o punto decimal, sin separadores de miles.";
    }
  }
  return errors;
};
