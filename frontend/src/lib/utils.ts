import { businessDateInput, businessDateLabel } from "./business-date";
export { cn } from "cn"

export function getInitials(name?: string): string {
  if (!name) return "U";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

export const formatDate = businessDateLabel;

export function toDateInputValue(value?: string | Date | null): string { return value ? businessDateInput(value) : ""; }

export function formatGender(value?: string): string {
  if (!value) return "—";
  const map: Record<string, string> = {
    male: "Male",
    female: "Female",
    other: "Other",
  };
  return map[value] ?? value;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export {formatMoney} from "./money-display";

export function formatAgeYearsMonthsDays(dateOfBirth?: string | Date | null): string {
  if (!dateOfBirth) return "";
  const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(dob.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    years = 0;
    months = 0;
    days = 0;
  }
  if (years > 0) return `${years} yr${years > 1 ? "s" : ""} ${months} mo`;
  if (months > 0) return `${months} mo ${days} day${days > 1 ? "s" : ""}`;
  return `${days} day${days > 1 ? "s" : ""}`;
}
