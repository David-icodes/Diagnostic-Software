export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "staff" | "operator";
  status: "active" | "inactive" | "suspended";
  createdAt?: string;
  updatedAt?: string;
}