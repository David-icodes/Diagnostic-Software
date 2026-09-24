import { api } from "@/lib/api";
import type { AuthResponse, LoginCredentials, User } from "@/types/auth";

export async function loginRequest(
  credentials: LoginCredentials,
): Promise<{ user: User }> {
  return api.post<AuthResponse>("/auth/login", credentials);
}

export async function logoutRequest(): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>("/auth/logout", {});
}

export async function getMe(): Promise<User> {
  const response = await api.get<AuthResponse>("/auth/me");
  return response.user;
}