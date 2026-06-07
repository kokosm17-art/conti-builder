"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getActiveSession, saveDesignResult } from "@/lib/session";

const STEPS = [
  "콘티 카피 분석 중...",
  "레이아웃 배치 결정 중...",
  "디자인 톤 적용 중...",
  "섹션 조립 중...",
  "마무리 중...",
];

export default function DesignGeneratePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    let cancelled = false;

    async function run() {
      const session = await getActiveSession(user!.uid);
      if (!session) { router.push("/generate"); return; }

      // 이미 생성된 결과가 있으면 바로 미리보기로
      if (session.designResult && session.designResult.sections.length > 0) {
        router.push(`/generate/preview/${session.id}`);
        return;
      }

      if (session.designGenCount >= 5) {
        if (!cancelled) setError("디자인 재생성 횟수(최대 5회)를 모두 소진하셨습니다.");
        return;
      }

      // 진행 스텝 애니메이션
      const interval = setInterval(() => {
        setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
      }, 1800);

      try {
        const res = await fetch("/api/design/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contiText: session.contiText,
            selectedTone: session.selectedTone,
            uploadedImageCount: Object.keys(session.assets ?? {}).length,
          }),
        });

        clearInterval(interval);

        if (!res.ok) {
          const data = await res.json();
          if (!cancelled) setError(data.error ?? "생성 중 오류가 발생했습니다.");
          return;
        }

        const { sections } = await res.json();
        await saveDesignResult(
          session.id,
          { sections, generatedAt: Date.now() },
          session.designGenCount
        );

        if (!cancelled) router.push(`/generate/preview/${session.id}`);
      } catch (err) {
        clearInterval(interval);
        if (!cancelled) setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-black text-gray-900 text-lg mb-2">디자인 생성 실패</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
        <button
          onClick={() => router.push("/generate/upload")}
          className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {/* 로딩 스피너 */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">✦</div>
        </div>

        <h1 className="text-xl font-black text-gray-900 mb-2">AI가 디자인을 조립하고 있어요</h1>
        <p className="text-sm text-gray-500 mb-8">약 10~20초 소요됩니다. 잠시만 기다려 주세요.</p>

        {/* 진행 스텝 */}
        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                i < stepIndex
                  ? "text-blue-600 font-semibold"
                  : i === stepIndex
                  ? "text-gray-900 font-semibold"
                  : "text-gray-300"
              }`}
            >
              <span className="w-5 text-center">
                {i < stepIndex ? "✓" : i === stepIndex ? "→" : "○"}
              </span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
