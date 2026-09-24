"use client";

import {
  ClipboardCheck,
  FlaskConical,
  Microscope,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { APP_CONFIG } from "@/lib/app-config";

const FEATURES = [
  { icon: ClipboardCheck, label: "Complete laboratory management" },
  { icon: Users, label: "Patient, billing & report workflows" },
  { icon: ShieldCheck, label: "Secure, role-based access" },
];

const currentYear = new Date().getFullYear();

export function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 10%, rgba(59,130,246,0.28), transparent 45%), radial-gradient(circle at 90% 90%, rgba(56,189,248,0.15), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="size-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {APP_CONFIG.name}
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              Diagnostic Centre & LIS
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1 text-xs text-sidebar-accent-foreground">
            <Microscope className="size-3.5" />
            Laboratory Information System
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Welcome to {APP_CONFIG.name}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/80">
            A comprehensive system for diagnostic centres — patients, laboratory
            tests, billing, and reports in one secure workflow.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.label} className="flex items-center gap-3 text-sm">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                  {feature.label}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          © {currentYear} {APP_CONFIG.name}. All rights reserved.
        </p>
      </div>

      {/* Login panel */}
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="mb-6 flex flex-col items-center gap-2 lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="size-6" />
            </div>
            <p className="text-lg font-semibold text-slate-800">
              {APP_CONFIG.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {APP_CONFIG.tagline}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-slate-800">
              Sign in to your account
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your username and password to continue.
            </p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {currentYear} {APP_CONFIG.name}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}