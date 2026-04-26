"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getActiveSession,
  createSession,
  incrementGeneration,
  saveGeneration,
  hashProduct,
} from "@/lib/session";
import { FormData } from "@/lib/types";
import { parseSections } from "@/lib/format-output";
import { generateDocx } from "@/lib/export";

// ─────────────────────────────────────────────
// 단계별 폼 데이터 기본값
// ─────────────────────────────────────────────
const INITIAL_FORM: FormData = {
  pageType: "wadiz",
  productName: "",
  mainCustomer: "",
  subCustomer: "",
  corePainPoint: "",
  customerDesire: "",
  usp1: "",
  usp2: "",
  usp3: "",
  additionalFeatures: "",
  authority: "",
  marketAwareness: "",
  marketSituation: "",
  priceInfo: "",
  toneAndManner: "",
};

const TONE_OPTIONS = [
  "감성적/따뜻한",
  "전문적/신뢰감",
  "MZ/트렌디",
  "유머러스/친근한",
  "프리미엄/럭셔리",
];

// ─────────────────────────────────────────────
// 로그인 유도 모달
// ─────────────────────────────────────────────
function LoginPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✦</div>
          <h2 className="text-xl font-black text-gray-900 mb-2">콘티 생성을 시작할게요!</h2>
          <p className="text-sm text-gray-500">
            로그인 후 AI 콘티를 생성할 수 있습니다.<br />
            회원가입은 무료이며, 테스트 기간 동안 무료로 이용 가능합니다.
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-700">
          <div className="font-semibold mb-1">🎁 테스트 기간 혜택</div>
          <div>· 무료 콘티 생성</div>
          <div>· 72시간 무제한 수정</div>
        </div>
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-center"
          >
            로그인하기
          </Link>
          <Link
            href="/register"
            className="block w-full border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            회원가입 (무료)
          </Link>
          <button onClick={onClose} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 결제 모달 (목업)
// ─────────────────────────────────────────────
function PaymentModal({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  function handlePay() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 1500);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-xl font-black text-gray-900 mb-2">콘티 제작 결제</h2>
        <p className="text-sm text-gray-500 mb-6">
          결제 후 72시간 동안 같은 제품으로 무제한 수정 가능합니다.
        </p>
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-gray-700">콘티 제작 1회권</span>
            <span className="text-blue-600">50,000원</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">VAT 포함</div>
        </div>
        <div className="space-y-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "결제 처리 중..." : "카드로 결제하기"}
          </button>
          <button
            onClick={onClose}
            className="w-full text-gray-500 text-sm py-2 hover:text-gray-700"
          >
            취소
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          ※ 현재 테스트 환경입니다
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 섹션 블록 컴포넌트
// ─────────────────────────────────────────────
function SectionBlock({
  title,
  intent,
  content,
  onCopy,
}: {
  title: string;
  intent: string;
  content: string;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold">{title}</h3>
        <button
          onClick={() => onCopy(intent + "\n\n" + content)}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 rounded-lg px-3 py-1 transition-colors"
        >
          복사
        </button>
      </div>
      {intent && (
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
          <div className="text-xs font-bold text-blue-600 mb-2 tracking-wider">기획 의도</div>
          <p className="text-sm text-blue-800 whitespace-pre-line leading-relaxed">{intent}</p>
        </div>
      )}
      <div className="px-6 py-6">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-loose font-[family-name:var(--font-noto)]">
          {content}
        </pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function GeneratePage() {
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = sessionStorage.getItem("contie_step");
      const n = saved ? Number(saved) : 0;
      return n >= 10 ? 0 : n;
    } catch { return 0; }
  });
  const [form, setForm] = useState<FormData>(() => {
    if (typeof window === "undefined") return INITIAL_FORM;
    try {
      const saved = sessionStorage.getItem("contie_form");
      return saved ? { ...INITIAL_FORM, ...JSON.parse(saved) } : INITIAL_FORM;
    } catch { return INITIAL_FORM; }
  });
  const [generating, setGenerating] = useState(false);
  const [rawOutput, setRawOutput] = useState("");
  const [, setSessionId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ productName: string; generationCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // 폼/스텝 변경 시 sessionStorage에 저장
  useEffect(() => {
    try {
      sessionStorage.setItem("contie_form", JSON.stringify(form));
      sessionStorage.setItem("contie_step", String(step));
    } catch {}
  }, [form, step]);

  // 활성 세션 로드
  useEffect(() => {
    if (!user) return;
    getActiveSession(user.uid).then((session) => {
      if (session) {
        setSessionId(session.id);
        setSessionInfo({
          productName: session.productName as string,
          generationCount: session.generationCount,
        });
        setForm((prev) => ({ ...prev, productName: session.productName as string }));
      }
    });
  }, [user]);

  // 생성 시작 (세션 체크 → 결제 or 바로 생성)
  async function handleGenerate() {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      // 활성 세션 있는지 확인
      const existingSession = await getActiveSession(user.uid);

      if (existingSession) {
        // 제품이 다른 경우 차단
        if (hashProduct(form.productName) !== existingSession.productHash) {
          alert(`현재 세션은 "${existingSession.productName}" 제품으로 고정되어 있습니다.\n새 제품은 수정 횟수 소진 후 시작할 수 있습니다.`);
          return;
        }
        // 30회 초과 차단
        if (existingSession.generationCount >= 30) {
          alert("수정 횟수 30회를 모두 사용하셨습니다.");
          return;
        }
        setSessionId(existingSession.id);
        setSessionInfo({ productName: existingSession.productName, generationCount: existingSession.generationCount });
        await runGeneration(existingSession.id);
        return;
      }

      const newSessionId = await createSession(user.uid, form.productName);
      setSessionId(newSessionId);
      setSessionInfo({ productName: form.productName, generationCount: 0 });
      await runGeneration(newSessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      alert(`콘티 생성 중 오류가 발생했습니다.\n${msg}\n\n잠시 후 다시 시도해 주세요.`);
      console.error(err);
    }
  }

  async function handlePaymentSuccess() {
    setShowPayment(false);
    if (!user) return;
    const newSessionId = await createSession(user.uid, form.productName);
    setSessionId(newSessionId);
    setSessionInfo({ productName: form.productName, generationCount: 0 });
    await runGeneration(newSessionId);
  }

  async function runGeneration(sid: string) {
    setGenerating(true);
    setRawOutput("");
    setStep(10); // 결과 단계

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: form }),
      });

      if (!res.ok) throw new Error("생성 실패");
      if (!res.body) throw new Error("스트림 없음");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        full += chunk;
        setRawOutput(full);
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }

      await incrementGeneration(sid);
      if (user) await saveGeneration(user.uid, sid, form, full);
      setSessionInfo(prev => prev ? { ...prev, generationCount: prev.generationCount + 1 } : prev);
    } catch (err) {
      setRawOutput("[오류] 콘티 생성 중 문제가 발생했습니다. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadDocx() {
    await generateDocx(rawOutput, form.productName);
  }

  function handleDownloadTxt() {
    const blob = new Blob([rawOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.productName}_콘티.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRevise() {
    if (!chatInput.trim() || generating) return;
    if (sessionInfo && sessionInfo.generationCount >= 30) {
      alert("수정 횟수 30회를 모두 사용하셨습니다.");
      return;
    }
    const request = chatInput.trim();
    const previousOutput = rawOutput;
    setChatInput("");
    setGenerating(true);
    setRawOutput("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: form, previousOutput, revisionRequest: request }),
      });
      if (!res.ok) throw new Error("수정 실패");
      if (!res.body) throw new Error("스트림 없음");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setRawOutput(full);
        outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
      setSessionInfo(prev => prev ? { ...prev, generationCount: prev.generationCount + 1 } : prev);
    } catch (err) {
      setRawOutput("[오류] 수정 중 문제가 발생했습니다. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  const update = (key: keyof FormData, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  if (authLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const parsed = rawOutput ? parseSections(rawOutput) : null;

  // ───────────────────────────────────────────
  // 결과 화면
  // ───────────────────────────────────────────
  if (step === 10) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              상세페이지의 정석 ✦
            </Link>
            <div className="flex items-center gap-3">
              {generating && (
                <span className="text-sm text-blue-600 animate-pulse">AI가 콘티를 작성하고 있습니다...</span>
              )}
              {!generating && rawOutput && (
                <>
                  <button onClick={handleDownloadTxt} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
                    TXT 다운로드
                  </button>
                  <button onClick={handleDownloadDocx} className="text-sm text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700">
                    Word 다운로드
                  </button>
                  <button
                    onClick={() => handleCopy(rawOutput)}
                    className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
                  >
                    {copied ? "복사됨 ✓" : "전체 복사"}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* 세션 배지 */}
          {sessionInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 mb-6 flex items-center justify-between">
              <div>
                <span className="text-blue-700 font-semibold text-sm">{sessionInfo.productName}</span>
                <span className="text-blue-500 text-xs ml-2">· 남은 수정 횟수 {Math.max(0, 30 - sessionInfo.generationCount)}회</span>
              </div>
              <span className="text-xs text-gray-400">
                총 30회 중 {sessionInfo.generationCount}회 사용
              </span>
            </div>
          )}

          {/* 타이틀 */}
          {parsed?.projectTitle && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <h1 className="text-2xl font-black text-gray-900 mb-2">{parsed.projectTitle}</h1>
              {parsed.coreCopy && (
                <p className="text-blue-600 font-semibold">{parsed.coreCopy}</p>
              )}
            </div>
          )}

          {/* 섹션들 */}
          <div className="space-y-6" ref={outputRef}>
            {parsed?.intro.content ? (
              <>
                <SectionBlock title="도입부" intent={parsed.intro.intent} content={parsed.intro.content} onCopy={handleCopy} />
                <SectionBlock title="본론부" intent={parsed.main.intent} content={parsed.main.content} onCopy={handleCopy} />
                <SectionBlock title="결론부" intent={parsed.conclusion.intent} content={parsed.conclusion.content} onCopy={handleCopy} />
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-loose font-[family-name:var(--font-noto)]">
                  {rawOutput || "콘티를 생성하고 있습니다..."}
                </pre>
              </div>
            )}
          </div>

          {/* 채팅 수정 입력창 */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">수정 요청하기</p>
            <div className="flex gap-3">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRevise();
                  }
                }}
                placeholder="예: 도입부 카피를 더 감성적으로 바꿔주세요 / 결론부에 얼리버드 혜택을 추가해주세요"
                disabled={generating}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRevise}
                  disabled={!chatInput.trim() || generating}
                  className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors h-full"
                >
                  {generating ? "수정 중..." : "수정 요청"}
                </button>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setStep(0); setRawOutput(""); setForm(INITIAL_FORM);
                  setSessionId(null); setSessionInfo(null); setChatInput("");
                  try { sessionStorage.removeItem("contie_form"); sessionStorage.removeItem("contie_step"); } catch {}
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                새 제품 시작 →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // 폼 화면
  // ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {showLoginModal && (
        <LoginPromptModal onClose={() => setShowLoginModal(false)} />
      )}
      {showPayment && (
        <PaymentModal onSuccess={handlePaymentSuccess} onClose={() => setShowPayment(false)} />
      )}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            상세페이지의 정석 ✦
          </Link>
          <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-3 py-1 rounded-full font-semibold">
            🎁 테스트 기간 무료
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* 타이틀 */}
        <div className="text-center mb-10">
          <div className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-3">INTERACTIVE STORYBOARD BUILDER</div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">
            팔리는 상세페이지 콘티,<br />지금 바로 만들어보세요
          </h1>
          <p className="text-gray-500 text-sm">입력만으로 전문가의 DNA를 이식해 드립니다. 단 3분 만에 완성해 보세요.</p>
        </div>

        {/* Step 0: 타입 선택 */}
        {step === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="text-center mb-8">
              <p className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-2">STEP 1 OF 1</p>
              <h2 className="text-2xl font-black text-gray-900 mb-2">어떤 상세페이지를 만드실 건가요?</h2>
              <p className="text-sm text-gray-500">선택에 따라 최적화된 콘티가 생성됩니다</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { update("pageType", "wadiz"); setStep(1); }}
                className="group border-2 border-gray-200 hover:border-blue-600 rounded-2xl p-6 text-left transition-all hover:shadow-md"
              >
                <div className="text-3xl mb-3">🚀</div>
                <div className="font-black text-gray-900 text-lg mb-1">와디즈 크라우드펀딩</div>
                <div className="text-sm text-gray-500 leading-relaxed">서포터의 공감과 펀딩 참여를<br />이끄는 스토리텔링 콘티</div>
                <div className="mt-4 text-xs font-semibold text-blue-600 group-hover:underline">선택하기 →</div>
              </button>
              <button
                onClick={() => { update("pageType", "general"); setStep(1); }}
                className="group border-2 border-gray-200 hover:border-blue-600 rounded-2xl p-6 text-left transition-all hover:shadow-md"
              >
                <div className="text-3xl mb-3">🛍️</div>
                <div className="font-black text-gray-900 text-lg mb-1">일반 쇼핑몰</div>
                <div className="text-sm text-gray-500 leading-relaxed">스마트스토어, 자사몰, 쿠팡 등<br />구매 전환을 극대화하는 콘티</div>
                <div className="mt-4 text-xs font-semibold text-blue-600 group-hover:underline">선택하기 →</div>
              </button>
            </div>
          </div>
        )}

        {/* 진행 바 */}
        {step > 0 && (
          <div className="flex items-center gap-1 mb-8 px-2">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-blue-600" : "bg-gray-200"}`}
              />
            ))}
          </div>
        )}

        {/* 선택된 타입 배지 */}
        {step > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${form.pageType === "wadiz" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {form.pageType === "wadiz" ? "🚀 와디즈 크라우드펀딩" : "🛍️ 일반 쇼핑몰"}
            </span>
            <button onClick={() => setStep(0)} className="text-xs text-gray-400 hover:text-gray-600">변경</button>
          </div>
        )}

        {/* 폼 카드 */}
        {step > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {step === 1 && (
            <FormStep title="제품명" subtitle="어떤 제품을 판매하시나요?">
              <Field label="브랜드 / 제품명 *" placeholder="예: 에어클린 프로">
                <input value={form.productName} onChange={e => update("productName", e.target.value)} placeholder="예: 에어클린 프로" className={inputCls} disabled={!!sessionInfo} />
                {sessionInfo && <p className="text-xs text-amber-600 mt-1">현재 세션 제품: {sessionInfo.productName}</p>}
              </Field>
            </FormStep>
          )}

          {step === 2 && (
            <FormStep title="고객 설정" subtitle="누구에게 팔 건가요?">
              <Field label="메인 고객 *" placeholder="예: 영유아 자녀를 둔 30~40대 부모">
                <textarea value={form.mainCustomer} onChange={e => update("mainCustomer", e.target.value)} placeholder="예: 영유아 자녀를 둔 30~40대 부모" className={`${inputCls} h-20 resize-none`} />
              </Field>
              <Field label="서브 고객 (선택)" placeholder="예: 반려동물을 키우는 1인 가구">
                <textarea value={form.subCustomer} onChange={e => update("subCustomer", e.target.value)} placeholder="예: 반려동물을 키우는 1인 가구" className={`${inputCls} h-20 resize-none`} />
              </Field>
            </FormStep>
          )}

          {step === 3 && (
            <FormStep title="고객의 핵심 고민 또는 갈망" subtitle="고객이 느끼는 불편함과 채워지지 않는 갈망을 작성해 주세요">
              <Field label="(문제) 고객이 지금 겪는 구체적인 불편함은 무엇인가요? *" placeholder="">
                <textarea
                  value={form.corePainPoint}
                  onChange={e => update("corePainPoint", e.target.value)}
                  placeholder="예: 미세먼지로 인한 실내 공기질 저하로 가족 건강이 걱정됩니다"
                  className={`${inputCls} h-24 resize-none`}
                />
              </Field>
              <Field label="(갈망) 제품을 소유함으로써 완성될 이상적인 이미지나 특별한 일상은 어떤 모습인가요? (선택)" placeholder="">
                <textarea
                  value={form.customerDesire}
                  onChange={e => update("customerDesire", e.target.value)}
                  placeholder={"예: 아이가 맑은 공기 속에서 편안하게 잠드는 집, 필터 걱정 없이 계절이 바뀌어도 늘 쾌적한 공간"}
                  className={`${inputCls} h-24 resize-none`}
                />
              </Field>
            </FormStep>
          )}

          {step === 4 && (
            <FormStep title="핵심 USP 3가지" subtitle="경쟁 제품과 다른 우리만의 차별점">
              <Field label="USP 1 *" placeholder="예: NASA 기술 기반 3단계 필터링으로 99.9% 미세먼지 제거">
                <input value={form.usp1} onChange={e => update("usp1", e.target.value)} placeholder="예: NASA 기술 기반 3단계 필터링" className={inputCls} />
              </Field>
              <Field label="USP 2 *" placeholder="예: 소음 없는 슬립 모드, 수면 중에도 24시간 공기정화">
                <input value={form.usp2} onChange={e => update("usp2", e.target.value)} placeholder="예: 소음 없는 슬립 모드" className={inputCls} />
              </Field>
              <Field label="USP 3 *" placeholder="예: 월 전기료 2천원대, 필터 교체 없이 1년 사용">
                <input value={form.usp3} onChange={e => update("usp3", e.target.value)} placeholder="예: 월 전기료 2천원대" className={inputCls} />
              </Field>
            </FormStep>
          )}

          {step === 5 && (
            <FormStep title="추가 상세 정보" subtitle="특징, 장점, 기획 배경 등 무엇이든 좋습니다. 자세한 정보는 더 매력적인 카피를 쓸 수 있는 강력한 무기가 됩니다.">
              <Field label="추가 장점 및 특징 (선택)" placeholder="">
                <textarea
                  value={form.additionalFeatures}
                  onChange={e => update("additionalFeatures", e.target.value)}
                  placeholder={"예:\n- 국내 유일 특허 기술 보유\n- 창업자가 직접 10년간 겪은 문제를 해결한 제품\n- 소재: 의료용 실리콘 + 항균 ABS\n- A/S 평생 보장\n- 론칭 후 72시간 만에 1,000개 완판 이력"}
                  className={`${inputCls} h-48 resize-none`}
                />
              </Field>
            </FormStep>
          )}

          {step === 6 && (
            <FormStep title="권위 & 신뢰" subtitle="리뷰, 수상, 인증, 누적판매량 등">
              <Field label="권위 정보 (선택)" placeholder="예: KC 인증, 누적 리뷰 3,500개 ★4.85, 와디즈 공기청정기 카테고리 1위">
                <textarea value={form.authority} onChange={e => update("authority", e.target.value)} placeholder="예: KC 인증, 누적 리뷰 3,500개 ★4.85, 와디즈 공기청정기 카테고리 1위" className={`${inputCls} h-28 resize-none`} />
              </Field>
            </FormStep>
          )}

          {step === 7 && (
            <FormStep title="시장 상황" subtitle="카테고리 트렌드나 시장 문제점">
              <Field label="고객 인지도 수준 *">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => update("marketAwareness", form.marketAwareness === "high" ? "" : "high")}
                    className={`border-2 rounded-xl p-4 text-left transition-all ${form.marketAwareness === "high" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                  >
                    <div className="text-xl mb-1">🔥</div>
                    <div className="font-bold text-gray-900 text-sm mb-1">인지도 높음</div>
                    <div className="text-xs text-gray-500 leading-relaxed">고객이 이미 필요성을 느끼고 있는 카테고리<br />예: 공기청정기, 마사지건, 텀블러</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => update("marketAwareness", form.marketAwareness === "low" ? "" : "low")}
                    className={`border-2 rounded-xl p-4 text-left transition-all ${form.marketAwareness === "low" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"}`}
                  >
                    <div className="text-xl mb-1">💡</div>
                    <div className="font-bold text-gray-900 text-sm mb-1">인지도 낮음</div>
                    <div className="text-xs text-gray-500 leading-relaxed">고객에게 제품 필요성부터 설득해야 하는 카테고리<br />예: 신개념 헬스케어 기기, 생소한 라이프스타일 제품</div>
                  </button>
                </div>
              </Field>
              <Field label="시장 상황/트렌드 (선택)" placeholder="예: 코로나 이후 실내 공기질에 대한 관심 급증">
                <textarea value={form.marketSituation} onChange={e => update("marketSituation", e.target.value)} placeholder="예: 코로나 이후 실내 공기질에 대한 관심 급증" className={`${inputCls} h-28 resize-none`} />
              </Field>
            </FormStep>
          )}

          {step === 8 && (
            <FormStep title="가격 정보" subtitle="시장 대비 가격 경쟁력을 포함해 자유롭게 입력하세요">
              <Field label="가격 정보 *" placeholder="예: 정가 280,000원 → 와디즈 특가 189,000원 (32% 할인). 동급 제품 대비 30% 저렴하면서 성능은 동급 최강">
                <textarea
                  value={form.priceInfo}
                  onChange={e => update("priceInfo", e.target.value)}
                  placeholder={"예: 정가 280,000원 → 와디즈 특가 189,000원 (32% 할인)\n동급 제품 대비 30% 저렴하면서 성능은 동급 최강"}
                  className={`${inputCls} h-32 resize-none`}
                />
              </Field>
            </FormStep>
          )}

          {step === 9 && (
            <FormStep title="톤앤매너" subtitle="어떤 분위기로 카피를 쓸까요?">
              <div className="flex flex-wrap gap-2 mb-4">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => update("toneAndManner", t)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      form.toneAndManner === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Field label="직접 입력 (선택)" placeholder="예: 친환경 브랜드의 진정성 있는 톤">
                <input
                  value={TONE_OPTIONS.includes(form.toneAndManner) ? "" : form.toneAndManner}
                  onChange={e => update("toneAndManner", e.target.value)}
                  placeholder="예: 친환경 브랜드의 진정성 있는 톤"
                  className={inputCls}
                />
              </Field>
            </FormStep>
          )}

          {/* 네비게이션 */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="text-sm text-gray-500 disabled:opacity-30 flex items-center gap-1 hover:text-gray-700"
            >
              ‹ 이전
            </button>

            {step < 9 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext(step, form)}
                className="bg-blue-600 text-white text-sm font-bold px-7 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                다음 ›
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!canNext(9, form) || generating}
                className="bg-blue-600 text-white text-sm font-bold px-7 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {generating ? "생성 중..." : "AI 콘티 생성하기 ✦"}
              </button>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 헬퍼 컴포넌트
// ─────────────────────────────────────────────
const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function FormStep({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-black text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; placeholder?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function canNext(step: number, form: FormData): boolean {
  const checks: Record<number, boolean> = {
    1: !!form.productName.trim(),
    2: !!form.mainCustomer.trim(),
    3: !!form.corePainPoint.trim(),
    4: !!form.usp1.trim() && !!form.usp2.trim() && !!form.usp3.trim(),
    5: true,
    6: true,
    7: !!form.marketAwareness,
    8: !!form.priceInfo.trim(),
    9: !!form.toneAndManner.trim(),
  };
  return checks[step] ?? true;
}
