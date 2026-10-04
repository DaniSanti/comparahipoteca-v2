import { MORTGAGE_LIMITS, type MortgageInput } from "./mortgage.ts";

export type MortgageField = keyof MortgageInput;
export type MortgageValidationErrors = Partial<Record<MortgageField, string>>;

const validateRange = (
  value: number | undefined,
  label: string,
  limits: { min: number; max: number },
): string | undefined => {
  if (value === undefined || !Number.isFinite(value)) return `${label} es obligatorio.`;
  if (value < limits.min) return `${label} no puede ser menor que ${limits.min}.`;
  if (value > limits.max) return `${label} no puede ser mayor que ${limits.max}.`;
  return undefined;
};

export const validateMortgageInput = (input: MortgageInput): MortgageValidationErrors => {
  const errors: MortgageValidationErrors = {};
  errors.purchasePrice = validateRange(input.purchasePrice, "El precio", MORTGAGE_LIMITS.purchasePrice);
  errors.savings = validateRange(input.savings, "El ahorro", MORTGAGE_LIMITS.savings);
  errors.termYears = validateRange(input.termYears, "El plazo", MORTGAGE_LIMITS.termYears);

  if (!Number.isInteger(input.termYears) && !errors.termYears) {
    errors.termYears = "El plazo debe indicarse en años completos.";
  }

  if (input.type === "fixed") {
    errors.fixedTin = validateRange(input.fixedTin, "El TIN", MORTGAGE_LIMITS.fixedTin);
  } else {
    errors.euribor = validateRange(input.euribor, "El Euríbor", MORTGAGE_LIMITS.euribor);
    errors.differential = validateRange(
      input.differential,
      "El diferencial",
      MORTGAGE_LIMITS.differential,
    );
  }

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
};

export const isMortgageInputValid = (input: MortgageInput): boolean =>
  Object.keys(validateMortgageInput(input)).length === 0;
