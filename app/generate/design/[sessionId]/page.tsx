"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSessionById, reactivateSession, saveHtmlDesign } from "@/lib/session";

const STEPS = [
  "콘티 분석 중...",
  "디자인 레이아웃 설계 중...",
  "타이포그래피 및 컬러 적용 중...",
  "섹션별 디자인 생성 중...",
  "마무리 중...",
];

export default function DesignGeneratePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    let cancelled = false;

    async function run() {
      // 이 화면은 URL의 sessionId로만 동작한다 — "지금 활성 세션이 뭔지"를
      // 다시 추측하지 않아, 다른 작업이 활성 세션을 바꿔치기해도 엉뚱한
      // 세션의 콘티로 디자인을 생성하는 사고를 원천적으로 막는다.
      const session = await getSessionById(sessionId, user!.uid);
      if (!session) { router.push("/mypage"); return; }
      if (session.status !== "active") {
        await reactivateSession(user!.uid, sessionId).catch(() => {});
      }
      if (cancelled) return;

      // 이미 HTML 디자인이 있으면 바로 미리보기로
      if (session.htmlDesign && session.htmlDesign.fullHtml) {
        router.push(`/generate/preview-html/${session.id}`);
        return;
      }

      // 구 방식 designResult만 있는 경우 — 구 미리보기로 (하위 호환)
      if (session.designResult && session.designResult.sections.length > 0 && !session.htmlDesign) {
        router.push(`/generate/preview/${session.id}`);
        return;
      }

      if (session.designGenCount >= 9999) { // TEMP: 로컬 테스트용 한도 해제, 테스트 후 5로 복원할 것
        if (!cancelled) setError("디자인 재생성 횟수(최대 5회)를 모두 소진하셨습니다.");
        return;
      }

      // 진행 스텝 애니메이션
      const interval = setInterval(() => {
        setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
      }, 2000);

      try {
        const res = await fetch("/api/design/generate-html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contiText: session.contiText,
            selectedTone: session.selectedTone ?? "minimal",
            fontChoice: session.fontChoice ?? "recommended",
            colorChoice: session.colorChoice ?? "recommended",
            alignChoice: session.alignChoice ?? "recommended",
          }),
        });

        clearInterval(interval);

        if (!res.ok) {
          const data = await res.json();
          if (!cancelled) setError(data.error ?? "생성 중 오류가 발생했습니다.");
          return;
        }

        const { htmlDesign } = await res.json();

        await saveHtmlDesign(session.id, htmlDesign, session.designGenCount);

        if (!cancelled) router.push(`/generate/preview-html/${session.id}`);
      } catch {
        clearInterval(interval);
        if (!cancelled) setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [user, authLoading, sessionId, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-black text-gray-900 text-lg mb-2">디자인 생성 실패</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
        <button
          onClick={() => router.push(`/generate/upload/${sessionId}`)}
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

        <h1 className="text-xl font-black text-gray-900 mb-2">디자인을 만들고 있어요</h1>
        <p className="text-sm text-gray-500 mb-8">약 20~40초 소요됩니다. 잠시만 기다려 주세요.</p>

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
