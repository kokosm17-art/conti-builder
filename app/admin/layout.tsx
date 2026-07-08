"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/admin";

const TABS = [
  { href: "/admin/reviews", label: "후기" },
  { href: "/admin/inquiries", label: "CS 문의" },
  { href: "/admin/usage", label: "이용 현황" },
  { href: "/admin/revenue", label: "매출" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!authLoading && !user) {
    router.push("/login");
    return null;
  }

  if (!authLoading && user && !isAdmin(user.uid)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl">🔒</div>
        <p className="font-black text-gray-900">접근 권한이 없습니다.</p>
        <button onClick={() => router.push("/")} className="text-blue-600 text-sm font-semibold hover:underline">
          홈으로
        </button>
      </div>
    );
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-gray-900">어드민</span>
          </div>
          <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-600">
            홈으로
          </button>
        </div>
        <nav className="max-w-3xl mx-auto px-6 flex gap-6 text-sm">
          {TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={`py-3 border-b-2 transition-colors ${
                pathname === tab.href
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
