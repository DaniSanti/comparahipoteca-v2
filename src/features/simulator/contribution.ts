import { parseDecimalNumber } from "./numberInput";

// Display rounding never feeds back into the saved contribution.
export function contributionPercent(priceText: string, savingsText: string): string {
  const price = parseDecimalNumber(priceText);
  const savings = parseDecimalNumber(savingsText);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(savings) || savings < 0 || savings > price) return "";
  return String(Math.round(savings / price * 100));
}

export function savingsFromPercent(priceText: string, percentText: string): string {
  const price = parseDecimalNumber(priceText);
  if (!Number.isFinite(price) || price <= 0 || !/^\d+$/.test(percentText) || Number(percentText) > 100) return "";
  return String(price * Number(percentText) / 100);
}
