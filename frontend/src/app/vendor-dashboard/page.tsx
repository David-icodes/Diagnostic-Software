import { redirect } from "next/navigation";

/** Kept for existing bookmarks and vendor-login redirects. */
export default function VendorDashboardPage() {
  redirect("/vendor-portal");
}
