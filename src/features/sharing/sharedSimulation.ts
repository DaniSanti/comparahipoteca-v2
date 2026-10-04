import type { MortgageInput } from "../../domain/mortgage.ts";
import { isMortgageInputValid } from "../../domain/mortgageValidation.ts";

const PARAMETER = "sim";
const VERSION = "1";

const finiteNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/**
 * v1 format: `1,f,price,savings,years,tin` or
 * `1,v,price,savings,years,euribor,differential`.
 */
export const serializeSharedSimulation = (
  input: MortgageInput,
  baseUrl: string,
): string => {
  if (!isMortgageInputValid(input)) {
    throw new Error("Cannot share an invalid mortgage");
  }

  const values =
    input.type === "fixed"
      ? [
          VERSION,
          "f",
          input.purchasePrice,
          input.savings,
          input.termYears,
          input.fixedTin,
        ]
      : [
          VERSION,
          "v",
          input.purchasePrice,
          input.savings,
          input.termYears,
          input.euribor,
          input.differential,
        ];
  const url = new URL(baseUrl);

  url.search = "";
  url.hash = "";
  url.searchParams.set(PARAMETER, values.join(","));
  return url.toString();
};

export const parseSharedSimulation = (urlOrSearch: string): MortgageInput | null => {
  try {
    const params = urlOrSearch.startsWith("?")
      ? new URLSearchParams(urlOrSearch)
      : new URL(urlOrSearch, "https://local.invalid").searchParams;
    const raw = params.get(PARAMETER);
    if (!raw) return null;

    const parts = raw.split(",");
    if (parts[0] !== VERSION) return null;
    const isFixed = parts[1] === "f";
    const isVariable = parts[1] === "v";
    if ((!isFixed && !isVariable) || parts.length !== (isFixed ? 6 : 7)) return null;

    const purchasePrice = finiteNumber(parts[2]);
    const savings = finiteNumber(parts[3]);
    const termYears = finiteNumber(parts[4]);
    if (purchasePrice === null || savings === null || termYears === null) return null;

    const input: MortgageInput = isFixed
      ? {
          purchasePrice,
          savings,
          termYears,
          type: "fixed",
          fixedTin: finiteNumber(parts[5]) ?? undefined,
        }
      : {
          purchasePrice,
          savings,
          termYears,
          type: "variable",
          euribor: finiteNumber(parts[5]) ?? undefined,
          differential: finiteNumber(parts[6]) ?? undefined,
        };

    return isMortgageInputValid(input) ? input : null;
  } catch {
    return null;
  }
};
