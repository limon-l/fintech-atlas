import Decimal from "decimal.js";
import { bpsFee, convertMinor, effectiveRate, formatRate } from "./money";

/**
 * SANDBOX FX
 * ----------
 * These are synthetic reference rates for the simulation, not executable market
 * data. A production deployment must replace this adapter with a licensed,
 * timestamped rate provider and persist the provider quote identifier.
 */
export const SANDBOX_RATE_SNAPSHOT = {
  asOf: "2026-10-31T09:00:00.000Z",
  source: "ATLAS sandbox reference rates (synthetic)",
  base: "USD",
  unitsPerUsd: {
    USD: "1",
    EUR: "0.9214",
    GBP: "0.7892",
    JPY: "151.42",
    CHF: "0.8821",
    SGD: "1.3421",
    AUD: "1.5214",
    CAD: "1.3876",
    INR: "83.942",
    AED: "3.6725",
    NGN: "1512.40",
    KES: "129.20",
    ZAR: "18.412",
    BRL: "5.087",
    MXN: "17.182",
    KWD: "0.3072",
    BHD: "0.3760",
  } as Record<string, string>,
} as const;

export const FX_MARKUP_BPS = 35;
export const FX_FIXED_FEE_MINOR = 100;
export const QUOTE_TTL_SECONDS = 90;

export function sandboxRate(from: string, to: string): string {
  if (from === to) return "1";
  const fromUnits = SANDBOX_RATE_SNAPSHOT.unitsPerUsd[from];
  const toUnits = SANDBOX_RATE_SNAPSHOT.unitsPerUsd[to];
  if (!fromUnits || !toUnits) throw new Error(`Unsupported currency pair ${from}/${to}`);
  return new Decimal(toUnits).div(fromUnits).toFixed(8);
}

export interface QuoteCalculation {
  rate: string;
  feeMinor: number;
  convertibleMinor: number;
  targetMinor: number;
  effectiveRate: string;
  rateLabel: string;
  expiresAt: string;
  asOf: string;
}

export function calculateSandboxQuote(
  sourceAmountMinor: number,
  from: string,
  to: string,
  now: Date = new Date()
): QuoteCalculation {
  if (sourceAmountMinor <= 0) throw new Error("Quote amount must be positive");
  const rate = sandboxRate(from, to);
  const proportional = bpsFee(sourceAmountMinor, FX_MARKUP_BPS);
  const feeMinor = Math.min(
    Math.max(proportional, FX_FIXED_FEE_MINOR),
    new Decimal(sourceAmountMinor).times("0.02").floor().toNumber(),
  );
  if (feeMinor >= sourceAmountMinor) throw new Error("Amount is too small after the FX fee");
  const convertibleMinor = sourceAmountMinor - feeMinor;
  const targetMinor = convertMinor(convertibleMinor, from, to, rate);
  return {
    rate,
    feeMinor,
    convertibleMinor,
    targetMinor,
    effectiveRate: effectiveRate(sourceAmountMinor, targetMinor, from, to),
    rateLabel: formatRate(rate, from, to),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000).toISOString(),
    asOf: SANDBOX_RATE_SNAPSHOT.asOf,
  };
}

/** Indicative conversion used for portfolio equivalents. Always disclose the basis. */
export function indicativeConvert(amountMinor: number, from: string, to: string): number {
  if (from === to) return amountMinor;
  return convertMinor(amountMinor, from, to, sandboxRate(from, to));
}
