"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureShareId, reactivateSession } from "@/lib/session";
import { replaceBlockTextInConti } from "@/lib/conti-parser";
import { useReviewGate } from "@/lib/use-review-gate";
import { ReviewModal } from "@/components/review-modal";
import { DesignSection, TextHierarchy } from "@/lib/types";
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
import { ArrowLeft, RefreshCw, Download, Link2, Zap, Pencil } from "lucide-react";

const UPLOAD_KEY = "contie_upload_slots";

const ASPECT_RATIO_OPTIONS: { label: string; value: string }[] = [
  { label: "3:4", value: "3/4" },
  { label: "4:5", value: "4/5" },
  { label: "1:1", value: "1/1" },
  { label: "4:3", value: "4/3" },
  { label: "16:9", value: "16/9" },
  { label: "원본", value: "original" },
];

const HIERARCHY_OPTIONS: { label: string; value: TextHierarchy }[] = [
  { label: "대제목", value: "headline" },
  { label: "소제목", value: "subhead" },
  { label: "본문", value: "body" },
  { label: "설명", value: "caption" },
];

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
  const [designEditCount, setDesignEditCount] = useState(0);
  const [designGenCount, setDesignGenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [syncContiText, setSyncContiText] = useState(true);
  const [editLoading, setEditLoading] = useState(false);

  const reviewGate = useReviewGate(user?.uid, "design");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    // sessionId가 바뀔 때 loading을 다시 true로 돌리지 않으면, 새 세션 데이터를
    // 불러오는 동안 이전 세션의 콘텐츠와 "섹션 재생성" 버튼이 그대로 남아 클릭
    // 가능한 상태가 되어, 이전 세션 데이터로 재생성한 결과가 새 세션에 저장되는
    // 문제가 생길 수 있다 (app/generate/conti/[sessionId]/page.tsx와 동일한 버그).
    let ignore = false;
    setLoading(true);
    loadSession(ignore);
    return () => { ignore = true; };
  }, [user, authLoading, sessionId]);

  async function loadSession(ignore = false) {
    const snap = await getDoc(doc(db, "sessions", sessionId));
    if (ignore) return;
    if (!snap.exists()) { router.push("/generate"); return; }
    const data = snap.data();
    if (data.userId !== user!.uid) { router.push("/generate"); return; }

    setContiText(data.contiText ?? "");
    setToneId(data.selectedTone ?? "minimal");
    setFontChoice(data.fontChoice ?? "recommended");
    setSectionRegenCount(data.sectionRegenCount ?? 0);
    setDesignEditCount(data.designEditCount ?? 0);
    setDesignGenCount(data.designGenCount ?? 0);
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

  // /generate/design은 "현재 활성 세션"을 기준으로 동작하므로,
  // 보고 있는 세션이 활성 세션이 아니면 먼저 이 세션을 활성화해야
  // 엉뚱한 세션의 콘티로 생성을 시도하거나 디자인이 유실되지 않는다
  async function goToDesignGenerate() {
    if (!user) return false;
    try {
      await reactivateSession(user.uid, sessionId);
      return true;
    } catch {
      alert("작업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
  }

  async function handleFullRegen() {
    if (designGenCount >= 5) {
      alert("재생성 횟수(최대 5회)를 모두 사용하셨습니다.");
      return;
    }
    if (!(await goToDesignGenerate())) return;
    await updateDoc(doc(db, "sessions", sessionId), { designResult: null });
    router.push("/generate/design");
  }

  async function handleStartDesignGenerate() {
    if (!(await goToDesignGenerate())) return;
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

  function openSectionEdit(sectionId: string) {
    setEditingSectionId(editingSectionId === sectionId ? null : sectionId);
    setEditInstruction("");
  }

  async function handleSectionEdit(sectionId: string) {
    if (designEditCount >= 30) {
      alert("디자인 수정 횟수(최대 30회)를 모두 사용하셨습니다.");
      return;
    }
    const instruction = editInstruction.trim();
    if (!instruction) return;
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    setEditLoading(true);
    try {
      const res = await fetch("/api/design/edit-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, instruction, selectedTone: toneId }),
      });
      if (!res.ok) throw new Error("수정 실패");
      const { section: updated } = await res.json();

      const updatedSections = sections.map((s) => s.id === sectionId ? updated : s);
      setSections(updatedSections);

      const firestoreUpdate: Record<string, unknown> = {
        "designResult.sections": updatedSections,
        designEditCount: designEditCount + 1,
      };

      let newContiText = contiText;
      if (syncContiText && JSON.stringify(updated.textLines) !== JSON.stringify(section.textLines)) {
        newContiText = replaceBlockTextInConti(contiText, sectionId, updated.textLines);
        firestoreUpdate.contiText = newContiText;
      }

      await updateDoc(doc(db, "sessions", sessionId), firestoreUpdate);
      setContiText(newContiText);
      setDesignEditCount((c) => c + 1);
      setEditingSectionId(null);
      setEditInstruction("");
    } catch {
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setEditLoading(false);
    }
  }

  // 색상·비율·줄 계층처럼 AI 불필요한 직접 수정 (즉시 저장)
  async function handleDirectSectionUpdate(sectionId: string, updates: Partial<DesignSection>) {
    const updatedSections = sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    );
    setSections(updatedSections);
    await updateDoc(doc(db, "sessions", sessionId), {
      "designResult.sections": updatedSections,
    });
  }

  function handleSlotImageUpload(slotIndex: number, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const key = `placeholder_${slotIndex}`;
      const newAssets = { ...assets, [key]: base64 };
      setAssets(newAssets);
      // sessionStorage 반영 — 슬롯이 없으면 추가, 있으면 업데이트
      try {
        const saved = sessionStorage.getItem(UPLOAD_KEY);
        const slots: { id: string; imageUrl: string | null }[] = saved ? JSON.parse(saved) : [];
        const idx = slots.findIndex((s) => s.id === key);
        if (idx >= 0) {
          slots[idx] = { ...slots[idx], imageUrl: base64 };
        } else {
          slots.push({ id: key, imageUrl: base64 });
        }
        sessionStorage.setItem(UPLOAD_KEY, JSON.stringify(slots));
      } catch {}
      // Firestore에도 저장 (새로고침/재접속 후에도 유지)
      try {
        await updateDoc(doc(db, "sessions", sessionId), {
          [`assets.${key}`]: base64,
        });
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
  const remainingEdit = Math.max(0, 30 - designEditCount);

  return (
    <div className="min-h-screen bg-gray-100">
      {reviewGate.showModal && (
        <ReviewModal
          onSubmit={(star, text) => reviewGate.handleSubmit(star, text, sessionId)}
          onSkip={reviewGate.handleSkip}
          title="디자인 완성, 어떠셨나요?"
          description={"완성된 디자인에 대한 솔직한 후기를 들려주세요.\n서비스 개선에 큰 도움이 됩니다."}
        />
      )}
      {/* ── 상단 액션바 ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => reviewGate.guardedNavigate(() => router.push("/generate/upload"))}
            className="shrink-0 text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-semibold mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
            섹션재생성 {remainingRegen}/30 · 섹션수정 {remainingEdit}/30
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
            disabled={designGenCount >= 30}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">재생성 ({Math.max(0, 5 - designGenCount)}/5)</span>
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
              onClick={handleStartDesignGenerate}
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
                    <div className="absolute inset-0 pointer-events-none z-20">
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        {/* 이미지 슬롯 추가/변경 */}
                        {section.imageSlotIndex !== null && (
                          <label className="cursor-pointer bg-white text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50">
                            {imageUrl ? "사진 변경" : "사진 추가"}
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
                        {/* 부분 수정 */}
                        {remainingEdit > 0 && (
                          <button
                            onClick={() => openSectionEdit(section.id)}
                            className="bg-white text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            수정
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 수정 요청 패널 */}
                  {editingSectionId === section.id && (
                    <div className="relative z-20 bg-white border-t border-gray-200 divide-y divide-gray-100">

                      {/* ① 이미지 비율 (이미지 슬롯 있는 섹션만) */}
                      {section.imageSlotIndex !== null && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold text-gray-500 mb-2">이미지 비율</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ASPECT_RATIO_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => handleDirectSectionUpdate(section.id, { imageAspectRatio: opt.value })}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                  (section.imageAspectRatio ?? "original") === opt.value
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ② 텍스트 색상 */}
                      <div className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-500 mb-2">텍스트 색상</p>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={section.textColorOverride ?? tone.textColor}
                            onChange={(e) =>
                              handleDirectSectionUpdate(section.id, { textColorOverride: e.target.value })
                            }
                            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                          />
                          <span className="text-xs text-gray-400 font-mono">
                            {section.textColorOverride ?? tone.textColor}
                          </span>
                          {section.textColorOverride && (
                            <button
                              onClick={() =>
                                handleDirectSectionUpdate(section.id, { textColorOverride: undefined })
                              }
                              className="text-xs text-gray-400 hover:text-gray-700 underline ml-auto"
                            >
                              초기화
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ③ 줄별 폰트 크기 */}
                      {section.textLines.length > 0 && (
                        <div className="px-4 py-3">
                          <p className="text-xs font-bold text-gray-500 mb-2">줄별 폰트 크기</p>
                          <div className="space-y-1.5">
                            {section.textLines.map((line, li) => {
                              const currentHierarchy =
                                section.lineHierarchies?.[li] ?? section.textHierarchy;
                              return (
                                <div key={li} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 truncate flex-1 min-w-0">
                                    {line.replace(/\*\*/g, "").substring(0, 24)}
                                    {line.length > 24 ? "…" : ""}
                                  </span>
                                  <select
                                    value={currentHierarchy}
                                    onChange={(e) => {
                                      const next = e.target.value as TextHierarchy;
                                      const base = section.lineHierarchies
                                        ?? Array(section.textLines.length).fill(section.textHierarchy);
                                      const updated = base.map((h: TextHierarchy, idx: number) =>
                                        idx === li ? next : h
                                      );
                                      handleDirectSectionUpdate(section.id, { lineHierarchies: updated });
                                    }}
                                    className="shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                                  >
                                    {HIERARCHY_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                          {section.lineHierarchies && (
                            <button
                              onClick={() =>
                                handleDirectSectionUpdate(section.id, { lineHierarchies: undefined })
                              }
                              className="mt-2 text-xs text-gray-400 hover:text-gray-700 underline"
                            >
                              초기화
                            </button>
                          )}
                        </div>
                      )}

                      {/* AI 수정 지시 */}
                      <div className="px-4 py-3 space-y-2">
                        <p className="text-xs font-bold text-gray-500">AI 카피·레이아웃 수정</p>
                        <textarea
                          value={editInstruction}
                          onChange={(e) => setEditInstruction(e.target.value)}
                          placeholder="예: 이 문구를 더 짧고 강하게 바꿔줘 / 이미지를 배경 전체로 꽉 채워줘 / 카드 2개로 나눠줘"
                          rows={2}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs text-gray-500">
                            <input
                              type="checkbox"
                              checked={syncContiText}
                              onChange={(e) => setSyncContiText(e.target.checked)}
                            />
                            콘티 원문에도 반영
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingSectionId(null)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              닫기
                            </button>
                            <button
                              onClick={() => handleSectionEdit(section.id)}
                              disabled={editLoading || !editInstruction.trim()}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {editLoading ? "적용 중..." : "AI 수정"}
                            </button>
                          </div>
                        </div>
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
