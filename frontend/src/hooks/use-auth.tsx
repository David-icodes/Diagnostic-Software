"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  getMe,
  loginRequest,
  logoutRequest,
  vendorLoginRequest,
} from "@/services/auth";
import type { LoginCredentials, User, VendorLoginCredentials } from "@/types/auth";

const ME_QUERY_KEY = ["auth", "me"] as const;

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionError: Error | null;
  isLoggingIn: boolean;
  loginError: Error | null;
  login: (credentials: LoginCredentials) => Promise<User | void>;
  loginVendor: (credentials: VendorLoginCredentials) => Promise<User | void>;
  logout: () => Promise<void>;
  clearLoginError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: getMe,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
  });

  const vendorLoginMutation = useMutation({
    mutationFn: vendorLoginRequest,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.clear();
    },
  });

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await loginMutation.mutateAsync(credentials);

      // The HttpOnly session cookie is scoped to the API's own domain, so the
      // browser cannot expose it to the frontend. Re-running GET /auth/me (with
      // credentials) is the only reliable confirmation that the session was
      // actually established before we enter the dashboard.
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });

      router.push(response.user.role === "vendor" ? "/vendor-portal" : "/dashboard");
      return response.user;
    },
    [loginMutation, queryClient, router],
  );

  const loginVendor = useCallback(
    async (credentials: VendorLoginCredentials) => {
      const response = await vendorLoginMutation.mutateAsync(credentials);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      // The returned role comes from the server's vendor lookup; the browser
      // never chooses or sends an application role.
      router.push(response.user.role === "vendor" ? "/vendor-portal" : "/dashboard");
      return response.user;
    },
    [vendorLoginMutation, queryClient, router],
  );

  const logout = useCallback(async () => {
    const vendor = meQuery.data?.role === "vendor";
    await logoutMutation.mutateAsync();
    queryClient.clear();
    router.push(vendor ? "/vendor-login" : "/login");
  }, [logoutMutation, queryClient, router, meQuery.data?.role]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isLoading: meQuery.isPending,
      sessionError: meQuery.error ?? null,
      isLoggingIn: loginMutation.isPending || vendorLoginMutation.isPending,
      loginError: loginMutation.error ?? vendorLoginMutation.error ?? null,
      login,
      loginVendor,
      logout,
      clearLoginError: () => {
        loginMutation.reset();
        vendorLoginMutation.reset();
      },
    }),
    [
      meQuery.data,
      meQuery.isPending,
      meQuery.error,
      loginMutation,
      vendorLoginMutation,
      login,
      loginVendor,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
