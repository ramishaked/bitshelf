// Money formatting for the UI: whole shekels/dollars with thousands
// separators, never raw "1500.00" from the numeric columns.

export function formatMoney(
  value: string | number | null | undefined,
  currency: "ILS" | "USD" | null | undefined,
): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const sign = currency === "USD" ? "$" : "₪";
  return `${sign}${Math.round(n).toLocaleString("en-US")}`;
}
