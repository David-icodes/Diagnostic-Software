"use client";

import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  loginSchema,
  vendorLoginSchema,
  type LoginFormValues,
  type VendorLoginFormValues,
} from "@/validations/auth";

type LoginMode = "admin" | "vendor";

/** One login screen, two existing server-side credential flows. */
export function LoginForm() {
  const { login, loginVendor, isLoggingIn, loginError, clearLoginError } = useAuth();
  const [mode, setMode] = useState<LoginMode>("admin");
  const [showPassword, setShowPassword] = useState(false);

  const adminForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const vendorForm = useForm<VendorLoginFormValues>({
    resolver: zodResolver(vendorLoginSchema),
    defaultValues: { clientCode: "", clientName: "", password: "" },
  });

  const errorMessage = loginError
    ? loginError instanceof ApiError
      ? loginError.message
      : "Login failed. Please try again."
    : null;

  const switchMode = (next: LoginMode) => {
    if (next === mode) return;
    setMode(next);
    setShowPassword(false);
    clearLoginError();
  };

  const onSubmitAdmin = async (values: LoginFormValues) => {
    clearLoginError();
    try {
      await login(values);
    } catch {
      // Error is surfaced through loginError for display.
    }
  };

  const onSubmitVendor = async (values: VendorLoginFormValues) => {
    clearLoginError();
    try {
      await loginVendor(values);
    } catch {
      // Error is surfaced through loginError for display.
    }
  };

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Login type"
        className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1"
      >
        <button
          type="button"
          role="tab"
          id="admin-login-tab"
          aria-selected={mode === "admin"}
          aria-controls="admin-login-panel"
          onClick={() => switchMode("admin")}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === "admin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          <ShieldCheck className="size-3.5" />
          Admin Login
        </button>
        <button
          type="button"
          role="tab"
          id="vendor-login-tab"
          aria-selected={mode === "vendor"}
          aria-controls="vendor-login-panel"
          onClick={() => switchMode("vendor")}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mode === "vendor"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          <Building2 className="size-3.5" />
          Vendor Client Login
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {mode === "admin" ? (
        <form
          id="admin-login-panel"
          role="tabpanel"
          aria-labelledby="admin-login-tab"
          onSubmit={adminForm.handleSubmit(onSubmitAdmin)}
          noValidate
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                autoComplete="username"
                className="h-8 pl-9"
                aria-invalid={Boolean(adminForm.formState.errors.username)}
                {...adminForm.register("username")}
              />
            </div>
            {adminForm.formState.errors.username && (
              <p className="text-xs text-destructive">{adminForm.formState.errors.username.message}</p>
            )}
          </div>
          <PasswordField
            id="admin-password"
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            error={adminForm.formState.errors.password?.message}
            registration={adminForm.register("password")}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn && <Loader2 className="size-4 animate-spin" />}
            {isLoggingIn ? "Signing in..." : "LOGIN"}
          </Button>
        </form>
      ) : (
        <form
          id="vendor-login-panel"
          role="tabpanel"
          aria-labelledby="vendor-login-tab"
          onSubmit={vendorForm.handleSubmit(onSubmitVendor)}
          noValidate
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="clientCode">Client Code</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clientCode"
                type="text"
                autoComplete="organization"
                className="h-8 pl-9"
                aria-invalid={Boolean(vendorForm.formState.errors.clientCode)}
                {...vendorForm.register("clientCode")}
              />
            </div>
            {vendorForm.formState.errors.clientCode && (
              <p className="text-xs text-destructive">{vendorForm.formState.errors.clientCode.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Client Name</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="clientName"
                type="text"
                autoComplete="organization"
                className="h-8 pl-9"
                aria-invalid={Boolean(vendorForm.formState.errors.clientName)}
                {...vendorForm.register("clientName")}
              />
            </div>
            {vendorForm.formState.errors.clientName && (
              <p className="text-xs text-destructive">{vendorForm.formState.errors.clientName.message}</p>
            )}
          </div>
          <PasswordField
            id="vendor-password"
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            error={vendorForm.formState.errors.password?.message}
            registration={vendorForm.register("password")}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn && <Loader2 className="size-4 animate-spin" />}
            {isLoggingIn ? "Signing in..." : "LOGIN AS VENDOR CLIENT"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Use the client code and client name assigned by the laboratory.
          </p>
        </form>
      )}
    </div>
  );
}

function PasswordField({
  id,
  show,
  onToggle,
  error,
  registration,
}: {
  id: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
  registration: UseFormRegisterReturn<"password">;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Password</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          className="h-8 pl-9 pr-10"
          aria-invalid={Boolean(error)}
          {...registration}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
