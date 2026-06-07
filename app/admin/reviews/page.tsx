"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star } from "lucide-react";

const ADMIN_EMAIL = "kokosm17@gmail.com";

interface Review {
  id: string;
  uid: string;
  star: number;
  text: string;
  createdAt: { seconds: number } | null;
}

function StarDisplay({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${s <= count ? "fill-yellow-400 text-yellow-400" : "fill-gray-100 text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (user.email !== ADMIN_EMAIL) return; // 접근 거부 (렌더링 단계에서 처리)

    loadReviews();
  }, [user, authLoading]);

  async function loadReviews() {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Review[];
    setReviews(data);
    setLoading(false);
  }

  // 접근 제어
  if (!authLoading && user && user.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl">🔒</div>
        <p className="font-black text-gray-900">접근 권한이 없습니다.</p>
        <button onClick={() => router.push("/")} className="text-blue-600 text-sm font-semibold hover:underline">
          홈으로
        </button>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">로딩 중...</div>
      </div>
    );
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.star, 0) / reviews.length).toFixed(1)
    : "-";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-gray-900">어드민</span>
            <span className="text-xs text-gray-400">후기 관리</span>
          </div>
          <button onClick={() => router.push("/")} className="text-xs text-gray-400 hover:text-gray-600">
            홈으로
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
            <div className="text-3xl font-black text-gray-900">{reviews.length}</div>
            <div className="text-xs text-gray-400 mt-1">총 후기</div>
          </div>
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
            <div className="text-3xl font-black text-yellow-500">★ {avg}</div>
            <div className="text-xs text-gray-400 mt-1">평균 별점</div>
          </div>
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100">
            <div className="text-3xl font-black text-blue-600">
              {reviews.filter((r) => r.text?.trim()).length}
            </div>
            <div className="text-xs text-gray-400 mt-1">텍스트 후기</div>
          </div>
        </div>

        {/* 후기 목록 */}
        {reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p>아직 후기가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => {
              const date = review.createdAt
                ? new Date(review.createdAt.seconds * 1000).toLocaleDateString("ko-KR", {
                    year: "numeric", month: "long", day: "numeric",
                  })
                : "";
              return (
                <div key={review.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <StarDisplay count={review.star} />
                    <span className="text-xs text-gray-400">{date}</span>
                  </div>
                  {review.text ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{review.text}</p>
                  ) : (
                    <p className="text-xs text-gray-300 italic">텍스트 후기 없음</p>
                  )}
                  <p className="text-xs text-gray-300 mt-2 font-mono">{review.uid.slice(0, 8)}...</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
