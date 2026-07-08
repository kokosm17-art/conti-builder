"use client";

import { useState } from "react";
import { createInquiry } from "@/lib/inquiries";
import { InquiryCategory } from "@/lib/types";

const CATEGORIES: InquiryCategory[] = ["콘티", "디자인", "결제", "기타"];

interface SessionOption {
  id: string;
  productName: string;
}

interface InquiryModalProps {
  uid: string;
  email: string;
  sessions: SessionOption[];
  onClose: () => void;
  onSubmitted: () => void;
}

export function InquiryModal({ uid, email, sessions, onClose, onSubmitted }: InquiryModalProps) {
  const [category, setCategory] = useState<InquiryCategory>("콘티");
  const [sessionId, setSessionId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const text = message.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const session = sessions.find((s) => s.id === sessionId);
      await createInquiry({
        uid,
        email,
        category,
        message: text,
        sessionId: sessionId || undefined,
        productName: session?.productName || undefined,
      });
      onSubmitted();
    } catch {
      alert("문의 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-black text-gray-900 mb-4">문의하기</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">문의 유형</label>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    category === c
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {sessions.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                관련 작업 (선택)
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">선택 안 함</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.productName || "(제품명 미정)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">문의 내용</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="어떤 문제가 있었는지 자세히 적어주세요."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2.5 rounded-xl hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="text-sm text-white bg-blue-600 rounded-xl px-5 py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "문의 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
