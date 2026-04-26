import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AuthProviderClient } from "@/components/auth-provider-client";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "상세페이지의 정석 — 팔리는 콘티를 AI로",
  description:
    "1,000개 프로젝트를 성공시킨 와디즈 PD 출신의 성공 DNA를 담은 상세페이지 콘티 자동 생성 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={notoSansKR.variable}>
      <body className="min-h-screen bg-white font-[family-name:var(--font-noto)] antialiased">
        <AuthProviderClient>{children}</AuthProviderClient>
      </body>
    </html>
  );
}
