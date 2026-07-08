import type { Metadata } from "next";
import { Noto_Sans_KR, Nanum_Gothic, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";
import { AuthProviderClient } from "@/components/auth-provider-client";

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
});

const nanumGothic = Nanum_Gothic({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nanum",
});

const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-barungothic",
});

export const metadata: Metadata = {
  title: "상세페이지의 정석 — 팔리는 콘티를 AI로",
  description:
    "1,500개+ 프로젝트를 성공시킨 와디즈 PD 출신 전문가들의 성공 DNA를 담은 상세페이지 콘티 자동 생성 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = [
    notoSansKR.variable,
    nanumGothic.variable,
    nanumMyeongjo.variable,
  ].join(" ");

  return (
    <html lang="ko" className={fontVars}>
      <body className="min-h-screen bg-white font-[family-name:var(--font-noto-sans-kr)] antialiased">
        <AuthProviderClient>{children}</AuthProviderClient>
      </body>
    </html>
  );
}
