"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star } from "lucide-react";

interface Review {
  id: string;
  uid: string;
  star: number;
  text: string;
  type?: "conti" | "design";
  createdAt: { seconds: number } | null;
}

const TYPE_LABEL: Record<string, string> = {
  conti: "콘티",
  design: "디자인",
};

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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    loadReviews();
  }, [user, authLoading]);

  async function loadReviews() {
    try {
      const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Review[];
      setReviews(data);
    } catch (err) {
      console.error("후기 목록 조회 실패:", err);
      setError(err instanceof Error ? err.message : "후기 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 animate-pulse font-semibold text-center py-20">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="font-black text-gray-900">후기 목록을 불러오지 못했습니다.</p>
        <p className="text-xs text-gray-400 font-mono break-all max-w-md">{error}</p>
      </div>
    );
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.star, 0) / reviews.length).toFixed(1)
    : "-";

  return (
    <div>
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
                  <div className="flex items-center gap-2">
                    <StarDisplay count={review.star} />
                    {review.type && (
                      <span className="text-xs font-semibold text-blue-500 bg-blue-50 rounded-full px-2 py-0.5">
                        {TYPE_LABEL[review.type] ?? review.type}
                      </span>
                    )}
                  </div>
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
  );
}
