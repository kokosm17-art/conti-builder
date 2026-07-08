"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface ReviewModalProps {
  onSubmit: (star: number, text: string) => void;
  onSkip: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  skipLabel?: string;
}

export function ReviewModal({
  onSubmit,
  onSkip,
  title = "사용해 보셨나요?",
  description = "솔직한 후기를 들려주세요.\n서비스 개선에 큰 도움이 됩니다.",
  submitLabel = "후기 남기고 계속하기",
  skipLabel = "건너뛰기",
}: ReviewModalProps) {
  const [star, setStar] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (star === 0) return;
    setSubmitting(true);
    await onSubmit(star, text);
  }

  const displayStar = hovered || star;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        {/* 타이틀 */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">✦</div>
          <h2 className="text-lg font-black text-gray-900 mb-1">
            {title}
          </h2>
          <p className="text-sm text-gray-500 whitespace-pre-line">
            {description}
          </p>
        </div>

        {/* 별점 */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setStar(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  s <= displayStar
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-gray-100 text-gray-200"
                }`}
              />
            </button>
          ))}
        </div>

        {star > 0 && (
          <p className="text-xs text-center text-blue-600 font-semibold mb-4">
            {["", "아쉬웠어요", "조금 아쉬웠어요", "보통이에요", "좋았어요", "매우 좋았어요"][star]}
          </p>
        )}

        {/* 한 줄 후기 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="한 줄 후기를 남겨주세요 (선택 사항)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
          maxLength={200}
        />

        {/* 버튼 */}
        <div className="space-y-2">
          <button
            onClick={handleSubmit}
            disabled={star === 0 || submitting}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {submitting ? "저장 중..." : submitLabel}
          </button>
          <button
            onClick={onSkip}
            disabled={submitting}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
