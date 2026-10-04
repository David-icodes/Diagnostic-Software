/**
 * Organisation branding for the printed report header.
 *
 * The project has no organisation/settings collection yet, so the report preview
 * header reads its values from public environment variables instead of baking
 * any single centre's details into the code. Every field is optional and defaults
 * to an empty string: with nothing configured the report header shows only the
 * report title, the applied criteria and the record count, and never invents a
 * name, address or phone number.
 *
 * Configure in `frontend/.env.local` (or the deployment environment):
 *
 *   NEXT_PUBLIC_ORG_NAME="Diagnostic Centre Name"
 *   NEXT_PUBLIC_ORG_ADDRESS="Street, Area, City - PIN"
 *   NEXT_PUBLIC_ORG_PHONE="+91 40 1234 5678"
 *   NEXT_PUBLIC_ORG_EMAIL="reports@example.com"
 *   NEXT_PUBLIC_ORG_LOGO="/logo.svg"
 */

export interface OrganisationBranding {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Path to a logo served from `public/`. Empty means "no logo". */
  logo: string;
}

function read(value: string | undefined): string {
  return (value ?? "").trim();
}

export const organisationBranding: OrganisationBranding = {
  name: read(process.env.NEXT_PUBLIC_ORG_NAME),
  address: read(process.env.NEXT_PUBLIC_ORG_ADDRESS),
  phone: read(process.env.NEXT_PUBLIC_ORG_PHONE),
  email: read(process.env.NEXT_PUBLIC_ORG_EMAIL),
  logo: read(process.env.NEXT_PUBLIC_ORG_LOGO),
};

/** True when at least one branding detail is configured. */
export function hasOrganisationBranding(
  branding: OrganisationBranding = organisationBranding,
): boolean {
  return Boolean(
    branding.name || branding.address || branding.phone || branding.email || branding.logo,
  );
}

/** Contact lines to print under the address, skipping the unconfigured ones. */
export function organisationContactLines(
  branding: OrganisationBranding = organisationBranding,
): string[] {
  return [
    branding.phone ? `Phone: ${branding.phone}` : "",
    branding.email ? `Email: ${branding.email}` : "",
  ].filter(Boolean);
}
