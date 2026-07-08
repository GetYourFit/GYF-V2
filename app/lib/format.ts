/** Format a catalog price for display, honouring the item's currency.

 *  Returns null when the price is absent (open-seed items without a feed price)
 *  so callers can omit the price line entirely rather than render "$0". Falls
 *  back to a plain rounded amount if Intl can't resolve the currency code. */
export function formatPrice(price?: number | null, currency?: string | null): string | null {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency ?? "$"}${Math.round(price)}`;
  }
}

/** Bare symbol for a currency code, for spots that need just the glyph
 *  (input placeholders, prefixes) rather than a fully formatted amount. */
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };
export function currencySymbol(currency?: string | null): string {
  return CURRENCY_SYMBOLS[currency ?? "USD"] ?? currency ?? "$";
}
