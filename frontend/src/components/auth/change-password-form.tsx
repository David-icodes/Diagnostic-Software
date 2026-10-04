"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { changePasswordRequest } from "@/services/auth";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/validations/auth";

/**
 * Self-service password change: only the four required fields. The username is
 * shown for context and is read-only — the server changes the password of the
 * signed-in account, never one named in the request body.
 */
export function ChangePasswordForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      username: user?.username ?? "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setError(null);
    setSuccess(null);
    try {
      await changePasswordRequest(values);
      setSuccess("Password changed successfully.");
      reset({
        username: user?.username ?? "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not change the password.",
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
          <KeyRound className="size-4" />
        </span>
        <h1 className="text-lg font-semibold text-slate-800">Change Password</h1>
      </div>

      <Card className="max-w-xl border-border shadow-sm">
        <CardContent className="p-4">
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              role="status"
              className="mb-3 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-username">Username</Label>
              <Input
                id="cp-username"
                type="text"
                readOnly
                className="h-8 bg-muted/50"
                {...register("username")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-current">Current Password</Label>
              <Input
                id="cp-current"
                type="password"
                autoComplete="current-password"
                className="h-8"
                aria-invalid={Boolean(errors.currentPassword)}
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-new">New Password</Label>
              <Input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                className="h-8"
                aria-invalid={Boolean(errors.newPassword)}
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm">Confirm Password</Label>
              <Input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                className="h-8"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Update Password
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ChangePasswordForm;
