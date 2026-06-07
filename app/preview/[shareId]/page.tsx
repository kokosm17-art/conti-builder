"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getSessionByShareId } from "@/lib/session";
import { DesignRenderer } from "@/components/design-renderer";
import { DesignSection } from "@/lib/types";

// 공유 링크 다운로드 허용 여부 (MVP: false, 추후 true로 전환 가능)
const SHARE_DOWNLOAD_ENABLED = false;

export default function SharePreviewPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [sections, setSections] = useState<DesignSection[]>([]);
  const [toneId, setToneId] = useState("minimal");
  const [fontChoice, setFontChoice] = useState("recommended");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getSessionByShareId(shareId).then((session) => {
      if (!session || !session.designResult) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = session as Record<string, unknown>;
      setToneId((data.selectedTone as string) ?? "minimal");
      setFontChoice((data.fontChoice as string) ?? "recommended");
      setAssets((data.assets as Record<string, string>) ?? {});
      const result = data.designResult as { sections: DesignSection[] };
      setSections(result.sections ?? []);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">불러오는 중...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-4xl">🔍</div>
        <p className="font-black text-gray-900 text-lg">디자인을 찾을 수 없습니다</p>
        <p className="text-sm text-gray-500 text-center">링크가 만료되었거나 잘못된 주소입니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 상단 바 */}
      <header className="bg-white border-b border-gray-100 py-3 px-6">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">
            상세페이지의 정석 ✦
          </span>
          {SHARE_DOWNLOAD_ENABLED && (
            <button className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              다운로드
            </button>
          )}
          {!SHARE_DOWNLOAD_ENABLED && (
            <span className="text-xs text-gray-400">미리보기 전용</span>
          )}
        </div>
      </header>

      {/* 디자인 렌더링 */}
      <div className="max-w-[800px] mx-auto py-6 px-4">
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <DesignRenderer
            sections={sections}
            toneId={toneId}
            fontChoice={fontChoice}
            assets={assets}
            motionEnabled={true}
          />
        </div>
      </div>

      {/* 하단 푸터 */}
      <footer className="py-8 text-center text-xs text-gray-400">
        상세페이지의 정석으로 제작된 디자인입니다
      </footer>
    </div>
  );
}
