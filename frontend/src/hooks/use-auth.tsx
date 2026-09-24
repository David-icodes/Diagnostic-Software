"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getMe, loginRequest, logoutRequest } from "@/services/auth";
import type { LoginCredentials, User } from "@/types/auth";

const ME_QUERY_KEY = ["auth", "me"] as const;

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionError: Error | null;
  isLoggingIn: boolean;
  loginError: Error | null;
  login: (credentials: LoginCredentials) => Promise<User | void>;
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
    onSuccess: (response) => {
      queryClient.setQueryData(ME_QUERY_KEY, response.user);
    },
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
      router.push("/dashboard");
      return response.user;
    },
    [loginMutation, router],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    queryClient.clear();
    router.push("/login");
  }, [logoutMutation, queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isLoading: meQuery.isPending,
      sessionError: meQuery.error ?? null,
      isLoggingIn: loginMutation.isPending,
      loginError: loginMutation.error ?? null,
      login,
      logout,
      clearLoginError: loginMutation.reset,
    }),
    [
      meQuery.data,
      meQuery.isPending,
      meQuery.error,
      loginMutation.isPending,
      loginMutation.error,
      loginMutation.reset,
      login,
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