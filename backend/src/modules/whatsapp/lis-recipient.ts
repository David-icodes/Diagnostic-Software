import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { ApiError } from "../../utils/api-error";

/** New LIS workflows only. Never writes back to the patient or changes legacy sending. */
export function normalizeLisRecipient(raw: string): string {
  const invalid = () => new ApiError(422, "A valid destination mobile number is required. Check the complete Indian mobile number or international country code.");
  const value = raw.trim();
  if (!value || !/^[+\d\s().-]+$/.test(value)) throw invalid();
  let compact = value.replace(/[\s().-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  // Reject embedded/multiple plus signs rather than stripping them into an unrelated number.
  if (!/^\+?\d+$/.test(compact)) throw invalid();
  const international = compact.startsWith("+") ? compact
    : compact.length === 10 ? `+91${compact}` : `+${compact}`;
  const phone = parsePhoneNumberFromString(international, { extract: false });
  if (!phone?.isValid() || !/^\+[1-9]\d{7,14}$/.test(phone.number)) throw invalid();
  return phone.number;
}