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
