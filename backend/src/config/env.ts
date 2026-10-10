import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  COOKIE_NAME: z.string().default("diagnostic_token"),
  // Cookie SameSite policy. Defaults to "lax"; set to "none" (requires HTTPS,
  // i.e. NODE_ENV=production) when the frontend and API are on different sites
  // and the browser must send the session cookie cross-site.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  // Optional comma-separated allow-list. When set it takes precedence over
  // FRONTEND_URL, so a production origin can be configured without a wildcard.
  CORS_ORIGINS: z.string().optional().default(""),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().optional().default(""),
  ADMIN_NAME: z.string().default("Administrator"),

  // WhatsApp Cloud API. Kept optional so the server still starts before the
  // webhook is configured; the webhook itself refuses to verify without a token.
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_WABA_ID: z.string().optional().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(""),
  WHATSAPP_APP_SECRET: z.string().optional().default(""),
  // Meta Graph API version. This is the project's existing name for the API
  // version setting (you may know it as "WHATSAPP_API_VERSION"); it defaults to
  // the version currently available in the Meta dashboard.
  WHATSAPP_GRAPH_VERSION: z.string().default("v26.0"),
  // Exact Meta languages for the new workflows. Empty means unavailable; never
  // inherit the legacy report_ready language or guess a locale.
  WHATSAPP_LAB_REPORT_READY_LANGUAGE: z.string().trim().default(""),
  WHATSAPP_LAB_INVOICE_READY_LANGUAGE: z.string().trim().default(""),
  WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: z.string().trim().default(""),
  // Retained compatibility setting. New LIS flows now default local numbers to India (+91).
  WHATSAPP_LOCAL_COUNTRY_CODE: z.string().trim().regex(/^\d{1,3}$|^$/).default(""),
  // API origin used by the isolated authenticated PDF renderer.
  WHATSAPP_RENDER_API_ORIGIN: z.string().url().default("http://localhost:5000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("[env] Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
