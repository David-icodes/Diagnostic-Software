export type UserRole = "admin" | "staff" | "operator" | "vendor";

export type UserStatus = "active" | "inactive" | "suspended";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  clientId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}
