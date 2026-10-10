import type { Metadata } from "next";
import { LoginPage } from "@/components/auth/login-page";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginRoute() {
  return <LoginPage />;
}