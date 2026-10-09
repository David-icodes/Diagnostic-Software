const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wholeWords(value: number): string {
  if (value < 20) return small[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${small[value % 10]}` : ""}`;
  for (const [size, label] of [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"], [100, "Hundred"]] as const) {
    if (value >= size) return `${wholeWords(Math.floor(value / size))} ${label}${value % size ? ` ${wholeWords(value % size)}` : ""}`;
  }
  return "";
}

/** Words derive from the saved paid amount, never a fixed example. */
export function rupeesInWords(amount: number): string {
  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise) || paise < 0) return "";
  const fraction = paise % 100;
  return `${wholeWords(Math.floor(paise / 100))} Rupees${fraction ? ` and ${wholeWords(fraction)} Paise` : ""} Only`;
}
