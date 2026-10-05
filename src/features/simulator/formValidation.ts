import type {
  MortgageField,
  MortgageValidationErrors,
} from "../../domain/mortgageValidation.ts";

export type TouchedFields = Partial<Record<MortgageField, boolean>>;

// Domain validation always runs; only field feedback waits for interaction.
export const getVisibleErrors = (
  errors: MortgageValidationErrors,
  touched: TouchedFields,
): MortgageValidationErrors =>
  Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched[field as MortgageField]),
  );

export const getCalculationIssue = (errors: MortgageValidationErrors): string =>
  Object.values(errors).find(Boolean) ?? "";
