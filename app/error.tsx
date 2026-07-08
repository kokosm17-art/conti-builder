"use client"; // 에러 바운더리는 반드시 클라이언트 컴포넌트여야 함

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="font-black text-gray-900 text-lg mb-2">문제가 발생했어요</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          예기치 못한 오류로 화면을 표시하지 못했어요.
          작성 중인 내용은 자동으로 저장되니 마이페이지에서 이어서 진행할 수 있어요.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => unstable_retry()}
          className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm"
        >
          다시 시도
        </button>
        <Link
          href="/mypage"
          className="text-gray-600 border border-gray-200 font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm"
        >
          마이페이지로 이동
        </Link>
      </div>
    </div>
  );
}
