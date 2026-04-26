"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const AuthProvider = dynamic(
  () => import("@/lib/auth-context").then((m) => ({ default: m.AuthProvider })),
  { ssr: false }
);

export function AuthProviderClient({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
