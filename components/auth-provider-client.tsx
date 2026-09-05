"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";

export function AuthProviderClient({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
