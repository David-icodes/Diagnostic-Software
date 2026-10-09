import { organisationBranding } from "@/config/organisation";

/** Public deployment branding only; no database centre master or credentials. */
export function GET() {
  return Response.json({ name: organisationBranding.name }, { headers: { "Cache-Control": "no-store" } });
}
