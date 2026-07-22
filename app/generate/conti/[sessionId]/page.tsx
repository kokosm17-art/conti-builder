"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseSections, detectChangedSections, SectionChangeInfo } from "@/lib/format-output";
import { ContiSectionBlock } from "@/components/conti-section-block";
import { ArrowLeft } from "lucide-react";
import {
  reactivateSession,
  incrementContiGen,
  incrementContiEdit,
  saveContiText,
  saveContiDraft,
} from "@/lib/session";
import { FormData } from "@/lib/types";

const MAX_GENERATION_COUNT = 30;

export default function ContiViewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [productName, setProductName] = useState("");
  const [contiText, setContiText] = useState("");
  const [formDraft, setFormDraft] = useState<FormData | undefined>(undefined);
  const [generationCount, setGenerationCount] = useState(0);
  const [contiGenCount, setContiGenCount] = useState(0);
  const [designExists, setDesignExists] = useState(false);
  const [htmlDesignExists, setHtmlDesignExists] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [changedSections, setChangedSections] = useState<Map<string, SectionChangeInfo>>(new Map());
  const titleRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const conclusionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    // sessionId가 바뀌었는데도(마이페이지에서 다른 세션 클릭) loading을 다시 true로
    // 돌리지 않으면, 새 세션 데이터를 불러오는 동안 이전 세션의 콘텐츠와 "재생성"
    // 버튼이 그대로 화면에 남아 클릭 가능한 상태가 된다. 그 틈에 재생성을 누르면
    // 아직 남아있던 이전 세션의 formDraft로 생성한 결과가 새 sessionId(현재 URL)에
    // 저장되어 버려 세션 간 콘티가 뒤바뀌는 문제가 있었다.
    let ignore = false;
    setLoading(true);

    (async () => {
      const snap = await getDoc(doc(db, "sessions", sessionId));
      if (ignore) return;
      if (!snap.exists()) { router.push("/mypage"); return; }
      const data = snap.data();
      if (data.userId !== user!.uid) { router.push("/mypage"); return; }

      setProductName(data.productName ?? "");
      setContiText(data.contiText || data.contiDraft || "");
      setFormDraft(data.formDraft as FormData | undefined);
      setGenerationCount(data.generationCount ?? 0);
      setContiGenCount(data.contiGenCount ?? 0);
      setDesignExists(!!data.designResult);
      setHtmlDesignExists(!!data.htmlDesign?.fullHtml);
      setLoading(false);
    })();

    return () => { ignore = true; };
  }, [user, authLoading, sessionId, router]);

  async function handleRegenerate() {
    if (contiGenCount >= 10) {
      alert("재생성 횟수(최대 10회)를 모두 사용하셨습니다.");
      return;
    }
    if (!formDraft || regenerating || generating) return;

    const prevText = contiText;
    setRegenerating(true);
    setChangedSections(new Map());
    setContiText("");
    let full = "";

    try {
      await reactivateSession(user!.uid, sessionId);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: { ...formDraft, productName } }),
      });
      if (!res.ok) throw new Error("재생성 실패");
      if (!res.body) throw new Error("스트림 없음");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setContiText(full);
      }

      await incrementContiGen(sessionId);
      await saveContiText(sessionId, full);
      setContiGenCount((c) => c + 1);
    } catch (err) {
      setContiText(prevText);
      if (full) await saveContiDraft(sessionId, full).catch(() => {});
      console.error(err);
      alert("재생성 중 문제가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRevise() {
    if (!chatInput.trim() || generating) return;
    if (generationCount >= MAX_GENERATION_COUNT) {
      alert(`수정 횟수 ${MAX_GENERATION_COUNT}회를 모두 사용하셨습니다.`);
      return;
    }
    const request = chatInput.trim();
    const previousOutput = contiText;
    setChatInput("");
    setGenerating(true);
    setChangedSections(new Map());
    setContiText("");  // 화면 초기화 후 스트리밍 시작
    let full = "";

    try {
      await reactivateSession(user!.uid, sessionId);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { ...formDraft, productName },
          previousOutput,
          revisionRequest: request,
        }),
      });
      if (!res.ok) throw new Error("수정 실패");
      if (!res.body) throw new Error("스트림 없음");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setContiText(full);  // 실시간 스트리밍 표시
      }

      const changed = detectChangedSections(previousOutput, full);
      setChangedSections(changed);
      setTimeout(() => setChangedSections(new Map()), 30000);

      const sectionRefMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
        title: titleRef, intro: introRef, main: mainRef, conclusion: conclusionRef,
      };
      const firstChanged = ["title", "intro", "main", "conclusion"].find(k => changed.has(k));
      if (firstChanged) {
        sectionRefMap[firstChanged].current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      await incrementContiEdit(sessionId);
      await saveContiText(sessionId, full);
      setGenerationCount((c) => c + 1);
    } catch (err) {
      setContiText(previousOutput);  // 오류 시 이전 콘티 복원
      if (full) await saveContiDraft(sessionId, full).catch(() => {});
      console.error(err);
      alert("수정 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadTxt() {
    const blob = new Blob([contiText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName}_콘티.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 디자인 생성 플로우는 톤 선택 → 이미지 업로드 → 디자인 생성 순서이므로
  // /generate/tone/[sessionId]부터 시작한다 (mypage.tsx의 handleGenerateDesign과
  // 동일 패턴). 톤/업로드/디자인 화면 모두 URL의 sessionId로만 동작해 "현재
  // 활성 세션이 뭔지"에 의존하지 않지만, 재생성 횟수 등 기존 활성 세션 기반
  // 정책과의 호환을 위해 이 세션을 활성 상태로 맞춰둔다
  async function handleGoToDesign() {
    try {
      await reactivateSession(user!.uid, sessionId);
      sessionStorage.removeItem("contie_form");
      sessionStorage.removeItem("contie_step");
      sessionStorage.removeItem("contie_form_session_id");
      router.push(`/generate/tone/${sessionId}`);
    } catch {
      alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  // 이미 생성된 디자인이 있으면 새로 생성하지 않고 완성된 디자인으로 바로 이동한다
  // (mypage.tsx의 handleViewDesign과 동일 패턴: HTML/CSS 방식이면 preview-html, 구 방식이면 preview)
  async function handleViewDesign() {
    try {
      await reactivateSession(user!.uid, sessionId);
      router.push(htmlDesignExists ? `/generate/preview-html/${sessionId}` : `/generate/preview/${sessionId}`);
    } catch {
      alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">콘티를 불러오는 중...</div>
      </div>
    );
  }

  const parsed = contiText ? parseSections(contiText) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/mypage"
            className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 마이페이지로
          </Link>
          {contiText && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating || generating || contiGenCount >= 10 || !formDraft}
                className="text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {regenerating ? "재생성 중..." : `재생성 (${Math.max(0, 10 - contiGenCount)}/10)`}
              </button>
              <button onClick={handleDownloadTxt} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
                TXT 다운로드
              </button>
              <button onClick={() => handleCopy(contiText)} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
                {copied ? "복사됨 ✓" : "전체 복사"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-black text-gray-900 mb-6">{productName || "(제품명 미정)"} — 콘티</h1>

        {!contiText ? (
          <div className="text-center py-24 text-gray-400">아직 생성된 콘티가 없어요.</div>
        ) : (
          <>
            {parsed && parsed.projectTitles.length > 0 && (
              <div ref={titleRef} className={`bg-white rounded-2xl border p-6 mb-6 transition-all duration-500 ${
                changedSections.has("title") ? "border-emerald-400 ring-2 ring-emerald-100" : "border-gray-200"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-gray-400">프로젝트 제목 후보</span>
                  {changedSections.has("title") && <span className="text-xs text-emerald-600">수정 완료 ✓</span>}
                </div>
                <ol className="space-y-1 mb-2">
                  {parsed.projectTitles.map((title, i) => (
                    <li key={i} className="text-xl font-black text-gray-900">
                      {i + 1}. {title}
                    </li>
                  ))}
                </ol>
                {parsed.coreCopy && (
                  <div className="mt-4">
                    <span className="text-xs font-bold text-gray-400 block mb-2">핵심 카피</span>
                    <p className="text-blue-600 font-semibold">{parsed.coreCopy}</p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-6">
              {parsed?.intro.content ? (
                <>
                  <div ref={introRef}>
                    <ContiSectionBlock title="도입부" intent={parsed.intro.intent} content={parsed.intro.content} onCopy={handleCopy}
                      changeInfo={changedSections.get("intro")} />
                  </div>
                  <div ref={mainRef}>
                    <ContiSectionBlock title="본론부" intent={parsed.main.intent} content={parsed.main.content} onCopy={handleCopy}
                      changeInfo={changedSections.get("main")} />
                  </div>
                  <div ref={conclusionRef}>
                    <ContiSectionBlock title="결론부" intent={parsed.conclusion.intent} content={parsed.conclusion.content} onCopy={handleCopy}
                      changeInfo={changedSections.get("conclusion")} />
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-loose font-[family-name:var(--font-noto-sans-kr)]">
                    {contiText}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {/* 디자인 생성/보기 CTA */}
        {contiText && (
          <div className="mt-8 flex justify-center">
            {designExists || htmlDesignExists ? (
              <button
                onClick={handleViewDesign}
                className="bg-blue-600 text-white font-bold px-10 py-4 rounded-xl hover:bg-blue-700 transition-colors text-base shadow-sm"
              >
                완성된 디자인 보러가기 →
              </button>
            ) : (
              <button
                onClick={handleGoToDesign}
                className="bg-blue-600 text-white font-bold px-10 py-4 rounded-xl hover:bg-blue-700 transition-colors text-base shadow-sm"
              >
                디자인 생성하기 ✦
              </button>
            )}
          </div>
        )}

        {/* 채팅 수정 입력창 */}
        {contiText && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">수정 요청하기</p>
              <span className="text-xs text-gray-400">
                남은 수정 횟수 {Math.max(0, MAX_GENERATION_COUNT - generationCount)} / {MAX_GENERATION_COUNT}
              </span>
            </div>
            <div className="flex gap-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRevise();
                  }
                }}
                placeholder="예: 도입부 카피를 더 감성적으로 바꿔주세요 / 결론부에 얼리버드 혜택을 추가해주세요"
                disabled={generating || generationCount >= MAX_GENERATION_COUNT}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
              <button
                onClick={handleRevise}
                disabled={!chatInput.trim() || generating || generationCount >= MAX_GENERATION_COUNT}
                className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors h-20"
              >
                {generating ? "수정 중..." : "수정 요청"}
              </button>
            </div>
            {generationCount >= MAX_GENERATION_COUNT && (
              <p className="mt-2 text-xs text-red-500">수정 횟수를 모두 사용하셨습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
