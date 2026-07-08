"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAllInquiries, replyToInquiry, InquiryItem } from "@/lib/inquiries";
import { InquiryStatus } from "@/lib/types";

const FILTERS: { label: string; value: InquiryStatus | "전체" }[] = [
  { label: "전체", value: "전체" },
  { label: "대기", value: "대기" },
  { label: "답변완료", value: "답변완료" },
];

export default function AdminInquiriesPage() {
  const { user, loading: authLoading } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<InquiryStatus | "전체">("전체");
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [user, authLoading]);

  async function load() {
    try {
      const data = await getAllInquiries();
      setInquiries(data);
    } catch (err) {
      console.error("문의 목록 조회 실패:", err);
      setError(err instanceof Error ? err.message : "문의 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen(item: InquiryItem) {
    if (openId === item.id) {
      setOpenId(null);
      return;
    }
    setOpenId(item.id);
    setReplyDraft(item.reply ?? "");
  }

  async function handleReply(item: InquiryItem) {
    const reply = replyDraft.trim();
    if (!reply) return;
    setSubmitting(true);
    try {
      await replyToInquiry(item.id, reply);
      setInquiries((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, reply, status: "답변완료" } : i))
      );
      setOpenId(null);
    } catch {
      alert("답변 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 animate-pulse font-semibold text-center py-20">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="font-black text-gray-900">문의 목록을 불러오지 못했습니다.</p>
        <p className="text-xs text-gray-400 font-mono break-all max-w-md">{error}</p>
      </div>
    );
  }

  const filtered = filter === "전체" ? inquiries : inquiries.filter((i) => i.status === filter);
  const waitingCount = inquiries.filter((i) => i.status === "대기").length;

  return (
    <div>
      {/* 요약 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-3xl font-black text-gray-900">{inquiries.length}</div>
          <div className="text-xs text-gray-400 mt-1">전체 문의</div>
        </div>
        <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
          <div className="text-3xl font-black text-orange-500">{waitingCount}</div>
          <div className="text-xs text-gray-400 mt-1">답변 대기</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              filter === f.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>해당하는 문의가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const date = item.createdAt
              ? new Date(item.createdAt.toMillis()).toLocaleDateString("ko-KR", {
                  year: "numeric", month: "long", day: "numeric",
                })
              : "";
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleOpen(item)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          item.status === "답변완료"
                            ? "bg-green-50 text-green-600"
                            : "bg-orange-50 text-orange-500"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                      <span className="text-xs text-gray-400">{date}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{item.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.email}
                      {item.productName ? ` · ${item.productName}` : ""}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">문의 내용</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.message}</p>
                    </div>

                    {item.reply && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">기존 답변</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.reply}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">답변 작성</p>
                      <textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        rows={4}
                        placeholder="고객에게 전달할 답변을 입력하세요."
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenId(null)}
                        className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100"
                      >
                        닫기
                      </button>
                      <button
                        onClick={() => handleReply(item)}
                        disabled={submitting || !replyDraft.trim()}
                        className="text-sm text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {item.status === "답변완료" ? "답변 수정" : "답변 등록"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
