"use client";

import { BRAND_ASSETS, BrandMark } from "@/components/brand/brand-mark";
import { LoginForm } from "@/components/auth/login-form";
import { APP_CONFIG } from "@/lib/app-config";

export function LoginPage() {
  return (
    <main className="lis-login">
      <section className="lis-login-panel" aria-labelledby="login-title">
        <BrandMark src={BRAND_ASSETS.header} />
        <h1 id="login-title">{APP_CONFIG.name}</h1>
        <p>Please login to access your account</p>
        <LoginForm />
      </section>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
      </p>
    </main>
  );
}
