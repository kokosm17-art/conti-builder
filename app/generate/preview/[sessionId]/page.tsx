"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureShareId } from "@/lib/session";
import { DesignSection } from "@/lib/types";
import { getToneById, TONES } from "@/components/design-system/tones";
import { getAppliedFont } from "@/components/design-system/fonts";
import {
  FullWideSection,
  SplitSection,
  StackSection,
  TextOnlySection,
  CardGridSection,
  ImageFullSection,
} from "@/components/design-renderer/layouts";
import { ArrowLeft, RefreshCw, Download, Link2, Zap } from "lucide-react";

const UPLOAD_KEY = "contie_upload_slots";

function getSectionComp(layout: string) {
  switch (layout) {
    case "full-wide":   return FullWideSection;
    case "split":       return SplitSection;
    case "stack":       return StackSection;
    case "card-grid":   return CardGridSection;
    case "image-full":  return ImageFullSection;
    default:            return TextOnlySection;
  }
}

export default function PreviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [sections, setSections] = useState<DesignSection[]>([]);
  const [contiText, setContiText] = useState("");
  const [toneId, setToneId] = useState("minimal");
  const [fontChoice, setFontChoice] = useState("recommended");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [sectionRegenCount, setSectionRegenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    loadSession();
  }, [user, authLoading, sessionId]);

  async function loadSession() {
    const snap = await getDoc(doc(db, "sessions", sessionId));
    if (!snap.exists()) { router.push("/generate"); return; }
    const data = snap.data();
    if (data.userId !== user!.uid) { router.push("/generate"); return; }

    setContiText(data.contiText ?? "");
    setToneId(data.selectedTone ?? "minimal");
    setFontChoice(data.fontChoice ?? "recommended");
    setSectionRegenCount(data.sectionRegenCount ?? 0);
    setMotionEnabled(data.motionEnabled !== false);

    if (data.designResult?.sections?.length) {
      setSections(data.designResult.sections);
    }

    // 이미지: sessionStorage 우선, 없으면 Firestore
    try {
      const saved = sessionStorage.getItem(UPLOAD_KEY);
      if (saved) {
        const slots: { id: string; imageUrl: string | null }[] = JSON.parse(saved);
        const map: Record<string, string> = {};
        slots.forEach((s) => { if (s.imageUrl) map[s.id] = s.imageUrl; });
        setAssets(map);
      } else if (data.assets) {
        setAssets(data.assets);
      }
    } catch {
      if (data.assets) setAssets(data.assets);
    }

    setLoading(false);
  }

  async function handleMotionToggle() {
    const next = !motionEnabled;
    setMotionEnabled(next);
    await updateDoc(doc(db, "sessions", sessionId), { motionEnabled: next });
  }

  async function handleFullRegen() {
    // designResult 초기화 후 생성 페이지로
    await updateDoc(doc(db, "sessions", sessionId), { designResult: null });
    router.push("/generate/design");
  }

  async function handleSectionRegen(sectionId: string) {
    if (sectionRegenCount >= 30) {
      alert("섹션 재생성 횟수(최대 30회)를 모두 사용하셨습니다.");
      return;
    }
    setRegenerating(sectionId);
    try {
      const res = await fetch("/api/design/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          contiText,
          selectedTone: toneId,
          uploadedImageCount: Object.keys(assets).length,
        }),
      });
      if (!res.ok) throw new Error("재생성 실패");
      const { section } = await res.json();
      const updatedSections = sections.map((s) => s.id === sectionId ? section : s);
      setSections(updatedSections);
      setSectionRegenCount((c) => c + 1);
      await updateDoc(doc(db, "sessions", sessionId), {
        "designResult.sections": updatedSections,
        sectionRegenCount: sectionRegenCount + 1,
      });
    } catch {
      alert("섹션 재생성 중 오류가 발생했습니다.");
    } finally {
      setRegenerating(null);
    }
  }

  function handleSlotImageUpload(slotIndex: number, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const key = `placeholder_${slotIndex}`;
      const newAssets = { ...assets, [key]: base64 };
      setAssets(newAssets);
      // sessionStorage 반영
      try {
        const saved = sessionStorage.getItem(UPLOAD_KEY);
        const slots = saved ? JSON.parse(saved) : [];
        const updated = slots.map((s: { id: string; imageUrl: string | null }) =>
          s.id === key ? { ...s, imageUrl: base64 } : s
        );
        sessionStorage.setItem(UPLOAD_KEY, JSON.stringify(updated));
      } catch {}
    };
    reader.readAsDataURL(file);
  }

  async function handleShareCopy() {
    try {
      const shareId = await ensureShareId(sessionId);
      const url = `${window.location.origin}/preview/${shareId}`;
      await navigator.clipboard.writeText(url);
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">미리보기 불러오는 중...</div>
      </div>
    );
  }

  const tone = getToneById(toneId) ?? TONES[4];
  const fontFamily = getAppliedFont(toneId, fontChoice);
  const remainingRegen = Math.max(0, 30 - sectionRegenCount);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── 상단 액션바 ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link
            href="/generate/upload"
            className="shrink-0 text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-semibold mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
            섹션재생성 {remainingRegen}/30
          </span>

          <div className="flex-1" />

          {/* 모션 토글 */}
          <button
            onClick={handleMotionToggle}
            className={`shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
              motionEnabled
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            <Zap className="w-3 h-3" />
            모션
          </button>

          {/* 전체 재생성 */}
          <button
            onClick={handleFullRegen}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">전체 재생성</span>
          </button>

          {/* 공유 링크 */}
          <button
            onClick={handleShareCopy}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            {copied ? "복사됨 ✓" : <span className="hidden sm:inline">링크 복사</span>}
          </button>

          {/* 다운로드 */}
          <button
            onClick={() => router.push(`/generate/download/${sessionId}`)}
            className="shrink-0 flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            다운로드
          </button>
        </div>
      </header>

      {/* ── 미리보기 ── */}
      <div className="max-w-[800px] mx-auto py-6 px-4">
        {sections.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="font-semibold mb-4">디자인 결과가 없습니다.</p>
            <button
              onClick={() => router.push("/generate/design")}
              className="text-blue-600 font-bold hover:underline"
            >
              디자인 생성하기 →
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: tone.background, fontFamily }}
          >
            {sections.map((section) => {
              const imageUrl =
                section.imageSlotIndex !== null
                  ? (assets[`placeholder_${section.imageSlotIndex}`] ?? null)
                  : null;
              const SectionComp = getSectionComp(section.layout);
              const isRegen = regenerating === section.id;

              return (
                <div key={section.id} className="relative group">
                  {/* 섹션 렌더 */}
                  {isRegen ? (
                    <div className="w-full flex items-center justify-center py-16 bg-blue-50/60">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-blue-600 font-semibold">섹션 재생성 중...</span>
                      </div>
                    </div>
                  ) : (
                    <SectionComp
                      section={section}
                      tone={tone}
                      fontFamily={fontFamily}
                      imageUrl={imageUrl}
                      motionEnabled={motionEnabled}
                    />
                  )}

                  {/* hover 오버레이 */}
                  {!isRegen && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        {/* 빈 슬롯 이미지 추가 */}
                        {section.imageSlotIndex !== null && !imageUrl && (
                          <label className="cursor-pointer bg-white text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50">
                            사진 추가
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && section.imageSlotIndex !== null) {
                                  handleSlotImageUpload(section.imageSlotIndex, f);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        {/* 섹션 재생성 */}
                        {remainingRegen > 0 && (
                          <button
                            onClick={() => handleSectionRegen(section.id)}
                            className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            재생성
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-black/5" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
