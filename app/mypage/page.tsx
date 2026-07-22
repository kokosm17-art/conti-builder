"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getAllSessions, reactivateSession, deleteSession } from "@/lib/session";
import { getMyInquiries, InquiryItem } from "@/lib/inquiries";
import { ArrowLeft, Trash2, MessageCircle } from "lucide-react";
import { PaymentGateModal } from "@/components/payment-gate-modal";
import { InquiryModal } from "@/components/inquiry-modal";

interface SessionSummary {
  id: string;
  productName: string;
  status: string;
  createdAt?: { toMillis: () => number };
  contiText?: string;
  contiDraft?: string;
  designResult?: { sections: unknown[] };
  htmlDesignExists?: boolean; // HTML/CSS 방식 디자인 존재 여부
  formStep?: number;
}

const STAGE = {
  design: { label: "디자인 완료", className: "bg-purple-50 text-purple-600 border-purple-200" },
  conti: { label: "콘티 완성", className: "bg-green-50 text-green-600 border-green-200" },
  writing: { label: "작성 중", className: "bg-amber-50 text-amber-600 border-amber-200" },
  empty: { label: "시작 전", className: "bg-gray-100 text-gray-400 border-gray-200" },
};

function stageOf(s: SessionSummary) {
  if (s.htmlDesignExists || s.designResult) return STAGE.design;
  if (s.contiText) return STAGE.conti;
  if (s.contiDraft || (s.formStep ?? 0) > 0) return STAGE.writing;
  return STAGE.empty;
}

function previewText(s: SessionSummary) {
  const text = s.contiText || s.contiDraft || "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? flat.slice(0, 90) + "…" : flat;
}

export default function MyPage() {
  const { user, loading: authLoading, freeTrialUsed } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login?redirect=/mypage"); return; }
    Promise.all([getAllSessions(user.uid), getMyInquiries(user.uid)]).then(([s, i]) => {
      setSessions(s as SessionSummary[]);
      setInquiries(i);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  function refreshInquiries() {
    if (!user) return;
    getMyInquiries(user.uid).then(setInquiries);
  }

  async function handleResume(s: SessionSummary) {
    if (!user || resumingId) return;
    if (s.status !== "active") {
      const ok = window.confirm(
        "현재 진행 중인 다른 작업이 있다면 자동으로 보관되고, 선택한 기록을 이어서 작성하게 됩니다.\n계속할까요?"
      );
      if (!ok) return;
      setResumingId(s.id);
      try {
        await reactivateSession(user.uid, s.id);
      } catch {
        alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setResumingId(null);
        return;
      }
    }
    // 브라우저에 남아있는 임시저장 내용을 비워, /generate가 Firestore에 저장된
    // 이 세션의 최신 작성 내용(formDraft/contiText)으로 복구하도록 한다.
    // (이미 active 상태인 세션이어도, 이전 방문 때 남은 빈 임시저장이 남아있으면
    // 복구 로직이 건너뛰어지는 문제가 있었음)
    sessionStorage.removeItem("contie_form");
    sessionStorage.removeItem("contie_step");
    sessionStorage.removeItem("contie_form_session_id");
    router.push("/generate");
  }

  async function handleDelete(s: SessionSummary) {
    if (!user || resumingId || deletingId) return;
    const ok = window.confirm("이 작성 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.");
    if (!ok) return;
    setDeletingId(s.id);
    try {
      await deleteSession(s.id);
      setSessions((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      alert("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleViewDesign(s: SessionSummary) {
    if (!user) return;
    if (s.status !== "active") {
      try {
        await reactivateSession(user.uid, s.id);
      } catch {
        alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    if (s.htmlDesignExists) {
      router.push(`/generate/preview-html/${s.id}`);
    } else {
      router.push(`/generate/preview/${s.id}`);
    }
  }

  async function handleViewConti(s: SessionSummary) {
    if (!user) return;
    if (s.status !== "active") {
      try {
        await reactivateSession(user.uid, s.id);
      } catch {
        alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    router.push(`/generate/conti/${s.id}`);
  }

  async function handleGenerateDesign(s: SessionSummary) {
    if (!user || resumingId) return;
    setResumingId(s.id);
    try {
      await reactivateSession(user.uid, s.id);
      sessionStorage.removeItem("contie_form");
      sessionStorage.removeItem("contie_step");
      sessionStorage.removeItem("contie_form_session_id");
    } catch {
      alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setResumingId(null);
      return;
    }
    router.push(`/generate/tone/${s.id}`);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">기록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {showPaymentGate && <PaymentGateModal onClose={() => setShowPaymentGate(false)} />}
      {showInquiryModal && user && (
        <InquiryModal
          uid={user.uid}
          email={user.email ?? ""}
          sessions={sessions.map((s) => ({ id: s.id, productName: s.productName }))}
          onClose={() => setShowInquiryModal(false)}
          onSubmitted={() => {
            setShowInquiryModal(false);
            refreshInquiries();
          }}
        />
      )}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/generate"
            className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 콘티 만들기로
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowInquiryModal(true)}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" /> 문의하기
            </button>
            <span className="font-black text-gray-900">마이페이지</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-black text-gray-900 mb-1">내 작성 기록</h1>
        <p className="text-sm text-gray-500 mb-8">
          작성하던 콘티와 완성된 디자인을 여기서 다시 확인하고 이어서 진행할 수 있어요.
          오류로 페이지를 벗어났더라도 임시저장된 내용이 남아 있습니다.
        </p>

        {sessions.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="mb-4">아직 작성한 콘티가 없어요.</p>
            {freeTrialUsed ? (
              <button
                onClick={() => setShowPaymentGate(true)}
                className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                콘티 작성하기 ✦
              </button>
            ) : (
              <a
                href="/generate?new=1"
                className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                무료 체험하기
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const stage = stageOf(s);
              const date = s.createdAt
                ? new Date(s.createdAt.toMillis()).toLocaleDateString("ko-KR", {
                    year: "numeric", month: "long", day: "numeric",
                  })
                : "";
              const text = previewText(s);
              return (
                <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-gray-900 truncate">
                        {s.productName || "(제품명 미정)"}
                      </span>
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${stage.className}`}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <span className="text-xs text-gray-400">{date}</span>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        aria-label="작성 기록 삭제"
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {text ? (
                    <p className="text-sm text-gray-500 leading-relaxed mb-3">{text}</p>
                  ) : (
                    <p className="text-sm text-gray-300 italic mb-3">아직 생성된 콘티가 없습니다.</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResume(s)}
                      disabled={resumingId === s.id}
                      className="text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {resumingId === s.id ? "불러오는 중..." : "이어서 작성하기"}
                    </button>
                    {s.contiText && (
                      <button
                        onClick={() => handleViewConti(s)}
                        className="text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        콘티 보기
                      </button>
                    )}
                    {(s.htmlDesignExists || s.designResult) && (
                      <button
                        onClick={() => handleViewDesign(s)}
                        className="text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        디자인 보기
                      </button>
                    )}
                    {s.contiText && !s.designResult && !s.htmlDesignExists && (
                      <button
                        onClick={() => handleGenerateDesign(s)}
                        disabled={resumingId === s.id}
                        className="text-sm font-semibold text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {resumingId === s.id ? "불러오는 중..." : "디자인 생성하기 ✦"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 내가 보낸 문의 */}
        {inquiries.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-black text-gray-900 mb-1">내가 보낸 문의</h2>
            <p className="text-sm text-gray-500 mb-6">
              문의 답변이 등록되면 아래에서 확인할 수 있어요.
            </p>
            <div className="space-y-3">
              {inquiries.map((inq) => {
                const date = inq.createdAt
                  ? new Date(inq.createdAt.toMillis()).toLocaleDateString("ko-KR", {
                      year: "numeric", month: "long", day: "numeric",
                    })
                  : "";
                return (
                  <div key={inq.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          inq.status === "답변완료"
                            ? "bg-green-50 text-green-600"
                            : "bg-orange-50 text-orange-500"
                        }`}
                      >
                        {inq.status}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                        {inq.category}
                      </span>
                      {inq.productName && (
                        <span className="text-xs text-gray-400">{inq.productName}</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{date}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{inq.message}</p>
                    {inq.reply && (
                      <div className="bg-gray-50 rounded-xl p-3 mt-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1">답변</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{inq.reply}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
