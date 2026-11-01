import Decimal from "decimal.js";

/**
 * ATLAS money model
 * -----------------
 * All persisted amounts are integer minor units (cents, pence, yen...).
 * Never use binary floating point for balances, fees or conversions.
 * FX rates are persisted as exact decimal strings and evaluated with Decimal.
 */

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CHF"
  | "SGD"
  | "AUD"
  | "CAD"
  | "INR"
  | "AED"
  | "NGN"
  | "KES"
  | "ZAR"
  | "BRL"
  | "MXN"
  | "KWD"
  | "BHD";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  decimals: number;
  symbol: string;
  country: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USD: { code: "USD", name: "US Dollar", decimals: 2, symbol: "$", country: "United States" },
  EUR: { code: "EUR", name: "Euro", decimals: 2, symbol: "€", country: "Euro area" },
  GBP: { code: "GBP", name: "British Pound", decimals: 2, symbol: "£", country: "United Kingdom" },
  JPY: { code: "JPY", name: "Japanese Yen", decimals: 0, symbol: "¥", country: "Japan" },
  CHF: { code: "CHF", name: "Swiss Franc", decimals: 2, symbol: "CHF", country: "Switzerland" },
  SGD: { code: "SGD", name: "Singapore Dollar", decimals: 2, symbol: "S$", country: "Singapore" },
  AUD: { code: "AUD", name: "Australian Dollar", decimals: 2, symbol: "A$", country: "Australia" },
  CAD: { code: "CAD", name: "Canadian Dollar", decimals: 2, symbol: "C$", country: "Canada" },
  INR: { code: "INR", name: "Indian Rupee", decimals: 2, symbol: "₹", country: "India" },
  AED: { code: "AED", name: "UAE Dirham", decimals: 2, symbol: "د.إ", country: "United Arab Emirates" },
  NGN: { code: "NGN", name: "Nigerian Naira", decimals: 2, symbol: "₦", country: "Nigeria" },
  KES: { code: "KES", name: "Kenyan Shilling", decimals: 2, symbol: "KSh", country: "Kenya" },
  ZAR: { code: "ZAR", name: "South African Rand", decimals: 2, symbol: "R", country: "South Africa" },
  BRL: { code: "BRL", name: "Brazilian Real", decimals: 2, symbol: "R$", country: "Brazil" },
  MXN: { code: "MXN", name: "Mexican Peso", decimals: 2, symbol: "MX$", country: "Mexico" },
  KWD: { code: "KWD", name: "Kuwaiti Dinar", decimals: 3, symbol: "KD", country: "Kuwait" },
  BHD: { code: "BHD", name: "Bahraini Dinar", decimals: 3, symbol: "BD", country: "Bahrain" },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

export function currencyDecimals(code: string): number {
  return isCurrencyCode(code) ? CURRENCIES[code].decimals : 2;
}

export function minorUnitFactor(code: string): number {
  return 10 ** currencyDecimals(code);
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

export function assertSafeMinor(value: number, context = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${context} must be a safe integer number of minor units`);
  }
}

/** Parse a user-entered decimal string into integer minor units without rounding. */
export function parseMoneyToMinor(input: string, currency: string): number {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new MoneyError("Enter a positive amount");
  }
  const decimals = currencyDecimals(currency);
  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new MoneyError(
      decimals === 0
        ? `${currency} does not accept decimal places`
        : `${currency} accepts at most ${decimals} decimal places`,
    );
  }
  const minor = new Decimal(trimmed).times(10 ** decimals);
  if (!minor.isInteger()) throw new MoneyError("Amount precision is invalid");
  const value = minor.toNumber();
  if (!Number.isSafeInteger(value)) throw new MoneyError("Amount is too large");
  return value;
}

/** Convert integer minor units to an exact decimal string (no floating point). */
export function minorToDecimalString(amountMinor: number, currency: string): string {
  assertSafeMinor(amountMinor);
  return new Decimal(amountMinor).div(10 ** currencyDecimals(currency)).toFixed(
    currencyDecimals(currency),
  );
}

export interface FormatMoneyOptions {
  locale?: string;
  signed?: boolean;
  compact?: boolean;
  currencyDisplay?: "symbol" | "narrowSymbol" | "code";
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  assertSafeMinor(amountMinor);
  const decimals = currencyDecimals(currency);
  const value = amountMinor / 10 ** decimals;
  const locale = options.locale ?? "en-US";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: options.currencyDisplay ?? "narrowSymbol",
    minimumFractionDigits: options.compact ? 0 : decimals,
    maximumFractionDigits: options.compact ? (Math.abs(value) >= 1000 ? 1 : decimals) : decimals,
    notation: options.compact ? "compact" : "standard",
    signDisplay: options.signed ? "always" : "auto",
  });
  return formatter.format(value);
}

export function formatMoneyParts(
  amountMinor: number,
  currency: string,
): { symbol: string; integer: string; fraction: string; negative: boolean } {
  assertSafeMinor(amountMinor);
  const decimals = currencyDecimals(currency);
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const factor = 10 ** decimals;
  const integerPart = Math.floor(abs / factor);
  const fractionPart = abs % factor;
  const symbol = CURRENCIES[currency as CurrencyCode]?.symbol ?? currency;
  return {
    symbol,
    integer: new Intl.NumberFormat("en-US").format(integerPart),
    fraction: decimals === 0 ? "" : String(fractionPart).padStart(decimals, "0"),
    negative,
  };
}

/**
 * Deterministic FX conversion. Rates are decimal strings. Rounding is
 * half-up on the target minor unit, and the policy is persisted with the quote.
 */
export function convertMinor(
  sourceAmountMinor: number,
  sourceCurrency: string,
  targetCurrency: string,
  rate: string | Decimal,
  rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP,
): number {
  assertSafeMinor(sourceAmountMinor, "source amount");
  const sourceMajor = new Decimal(sourceAmountMinor).div(10 ** currencyDecimals(sourceCurrency));
  const targetMajor = sourceMajor.times(rate);
  const targetMinor = targetMajor.times(10 ** currencyDecimals(targetCurrency)).toDecimalPlaces(0, rounding);
  const value = targetMinor.toNumber();
  if (!Number.isSafeInteger(value)) throw new MoneyError("Converted amount is too large");
  return value;
}

/** Fee in basis points, rounded half-up to the source minor unit. */
export function bpsFee(amountMinor: number, bps: number): number {
  assertSafeMinor(amountMinor);
  if (!Number.isInteger(bps) || bps < 0) throw new MoneyError("Invalid fee basis points");
  return new Decimal(amountMinor).times(bps).div(10_000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function sumMinor(values: number[]): number {
  const total = values.reduce((acc, value) => {
    assertSafeMinor(value);
    const next = acc + value;
    assertSafeMinor(next, "running total");
    return next;
  }, 0);
  assertSafeMinor(total, "total");
  return total;
}

export function applyRateMarkup(rate: string, markupBps: number): string {
  const marked = new Decimal(rate).times(new Decimal(10_000 + markupBps)).div(10_000);
  return marked.toFixed(8);
}

export function formatRate(rate: string, from: string, to: string): string {
  return `1 ${from} = ${new Decimal(rate).toFixed(from === "JPY" ? 6 : 4)} ${to}`;
}

export function effectiveRate(
  sourceMinor: number,
  targetMinor: number,
  sourceCurrency: string,
  targetCurrency: string,
): string {
  const sourceMajor = new Decimal(sourceMinor).div(10 ** currencyDecimals(sourceCurrency));
  const targetMajor = new Decimal(targetMinor).div(10 ** currencyDecimals(targetCurrency));
  if (sourceMajor.isZero()) return "0";
  return targetMajor.div(sourceMajor).toFixed(6);
}

export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}
