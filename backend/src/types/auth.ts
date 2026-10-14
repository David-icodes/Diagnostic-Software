export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "staff" | "operator" | "vendor";
  clientId?: string;
  sessionVersion?: number;
  status: "active" | "inactive" | "suspended";
  createdAt?: string;
  updatedAt?: string;
}
