"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getSessionById, reactivateSession, updateDesignAssets } from "@/lib/session";
import { PLACEHOLDER_RE } from "@/lib/conti-parser";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Upload, ImageIcon, GripVertical } from "lucide-react";

const STORAGE_KEY = "contie_upload_slots";
const STORAGE_SESSION_KEY = "contie_upload_slots_session_id";

interface Slot {
  id: string;
  guideText: string;
  imageUrl: string | null;
  aspectRatio: string; // "3/4"|"4/5"|"1/1"|"4/3"|"16/9"|"original"
}

const ASPECT_RATIO_OPTIONS: { label: string; value: string }[] = [
  { label: "3:4", value: "3/4" },
  { label: "4:5", value: "4/5" },
  { label: "1:1", value: "1/1" },
  { label: "4:3", value: "4/3" },
  { label: "16:9", value: "16/9" },
  { label: "원본", value: "original" },
];

function parsePlaceholders(contiText: string): Slot[] {
  // 디자인 생성(lib/design-ai.ts)과 동일하게 "한 줄 전체가 (설명)"인 라인만
  // 이미지 자리로 인식해야 슬롯 번호(placeholder_N)가 AI가 매기는
  // imageSlotIndex와 일치한다. 본문 중간의 괄호(예: "VOC(휘발성 유기화합물)")는 제외.
  const results: Slot[] = [];
  let i = 0;
  for (const line of contiText.split("\n")) {
    const match = line.match(PLACEHOLDER_RE);
    if (match) {
      results.push({ id: `placeholder_${i}`, guideText: match[1], imageUrl: null, aspectRatio: "original" });
      i++;
    }
  }
  return results;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE_MB = 10;

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<{
    id: string;
    contiText?: string;
    assets?: Record<string, string>;
    htmlDesign?: { fullHtml: string } | null;
    designResult?: { sections: unknown[] } | null;
  } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    let ignore = false;

    // 이 화면도 URL의 sessionId로만 동작한다 — getActiveSession으로 "지금
    // 활성 세션이 뭔지" 다시 추측하지 않는다.
    getSessionById(sessionId, user.uid).then(async (active) => {
      if (ignore) return;
      if (!active) {
        alert("작업 기록을 찾을 수 없습니다.");
        router.push("/mypage");
        return;
      }
      if (!active.contiText) {
        alert("콘티 데이터를 찾을 수 없습니다. 콘티 생성을 먼저 완료해 주세요.");
        router.push("/generate");
        return;
      }
      if (active.status !== "active") {
        await reactivateSession(user.uid, sessionId).catch(() => {});
      }
      if (ignore) return;
      setSession(active as typeof session & { htmlDesign?: { fullHtml: string } | null; designResult?: { sections: unknown[] } | null });
      const parsed = parsePlaceholders(active.contiText);
      // sessionStorage에서 이미지 복원 (탭 닫지 않은 경우) — 단, 이 캐시가
      // 지금 이 세션(sessionId)을 위한 것이었는지 꼬리표로 확인한 뒤에만 사용한다.
      // 다른 세션 작업 중 남은 캐시라면 엉뚱한 사진이 이 세션 슬롯에 붙을 수 있다.
      try {
        const cachedSessionId = sessionStorage.getItem(STORAGE_SESSION_KEY);
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved && cachedSessionId === sessionId) {
          const savedSlots: Slot[] = JSON.parse(saved);
          parsed.forEach((slot) => {
            const found = savedSlots.find((s) => s.id === slot.id);
            if (found?.imageUrl) slot.imageUrl = found.imageUrl;
            if (found?.aspectRatio) slot.aspectRatio = found.aspectRatio;
          });
        }
      } catch {}
      setSlots(parsed);
    }).finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [user, authLoading, sessionId, router]);

  function persistSlots(newSlots: Slot[]) {
    try {
      const data = newSlots.map((s) => ({ id: s.id, guideText: s.guideText, imageUrl: s.imageUrl, aspectRatio: s.aspectRatio }));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      sessionStorage.setItem(STORAGE_SESSION_KEY, sessionId);
    } catch {}
  }

  function handleAspectRatioChange(placeholderId: string, ratio: string) {
    const newSlots = slots.map((s) => s.id === placeholderId ? { ...s, aspectRatio: ratio } : s);
    setSlots(newSlots);
    persistSlots(newSlots);
  }

  async function saveAssets(newSlots: Slot[]) {
    if (!session) return;
    // sessionStorage에 먼저 저장 (base64 원본)
    persistSlots(newSlots);
    // Firestore에는 슬롯 키만 저장 (base64 제외 — 문서 크기 1MB 한도 방지)
    const assetKeys = Object.fromEntries(
      newSlots.filter((s) => s.imageUrl).map((s) => [s.id, "uploaded"])
    );
    await updateDesignAssets(session.id, assetKeys).catch(() => {});
  }

  async function handleFileSelect(placeholderId: string, file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("JPG, PNG, GIF, WEBP 파일만 업로드 가능합니다.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`);
      return;
    }
    setUploading(placeholderId);
    try {
      const base64 = await fileToBase64(file);
      const newSlots = slots.map((s) => s.id === placeholderId ? { ...s, imageUrl: base64 } : s);
      setSlots(newSlots);
      await saveAssets(newSlots);
    } catch (err) {
      alert("이미지 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
      console.error(err);
    } finally {
      setUploading(null);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleDelete(placeholderId: string) {
    const newSlots = slots.map((s) => s.id === placeholderId ? { ...s, imageUrl: null } : s);
    setSlots(newSlots);
    await saveAssets(newSlots);
  }

  async function handleDrop(targetId: string) {
    if (!dragFrom || dragFrom === targetId) { setDragFrom(null); return; }
    const fromSlot = slots.find((s) => s.id === dragFrom);
    const toSlot = slots.find((s) => s.id === targetId);
    if (!fromSlot) { setDragFrom(null); return; }
    const newSlots = slots.map((s) => {
      if (s.id === dragFrom) return { ...s, imageUrl: toSlot?.imageUrl ?? null };
      if (s.id === targetId) return { ...s, imageUrl: fromSlot.imageUrl };
      return s;
    });
    setSlots(newSlots);
    setDragFrom(null);
    await saveAssets(newSlots);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">이미지 슬롯 준비 중...</div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-5 px-6">
        <div className="text-center">
          <p className="font-black text-gray-900 text-lg mb-2">이미지 자리를 찾지 못했어요</p>
          <p className="text-sm text-gray-500">콘티에 (이미지 설명) 형식의 자리표시자가 없습니다.</p>
        </div>
        <button
          onClick={() => router.push(`/generate/design/${sessionId}`)}
          className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          이미지 없이 디자인 생성하기 ✦
        </button>
      </div>
    );
  }

  const filledCount = slots.filter((s) => s.imageUrl).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href={`/generate/tone/${sessionId}`}
            className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 톤 선택으로
          </Link>
          <span className="text-xs bg-blue-100 text-blue-800 font-bold px-3 py-1.5 rounded-full">
            디자인 자동화 ✦ 2단계
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-10">
        {/* 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            콘티에서 찾은 이미지 자리{" "}
            <span className="text-blue-600">{slots.length}곳</span>에<br />
            사진을 업로드해 주세요
          </h1>
          <p className="text-sm text-gray-500">
            업로드하지 않은 슬롯은 회색 박스로 디자인에 포함됩니다.
            미리보기 화면에서도 추가할 수 있어요.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
            <span>
              {filledCount}/{slots.length} 업로드 완료
            </span>
            {filledCount > 0 && (
              <span className="text-blue-500 font-semibold">
                · 슬롯 간 드래그로 위치 교체 가능
              </span>
            )}
          </div>
        </div>

        {/* 슬롯 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {slots.map((slot, idx) => (
            <div key={slot.id} className="flex flex-col gap-2">
            <div
              className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-200 select-none ${
                dragFrom === slot.id
                  ? "opacity-40 scale-95 border-blue-400"
                  : dragFrom
                  ? "border-dashed border-blue-300 bg-blue-50/50"
                  : slot.imageUrl
                  ? "border-gray-200 bg-white shadow-sm hover:shadow-md"
                  : "border-dashed border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50/30"
              }`}
              style={{ aspectRatio: "3/4" }}
              draggable={!!slot.imageUrl}
              onDragStart={(e) => {
                setDragFrom(slot.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(slot.id)}
            >
              {/* 공통 file input — label htmlFor로 연결 */}
              <input
                id={`upload-${slot.id}`}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                disabled={uploading === slot.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(slot.id, file);
                  e.target.value = "";
                }}
              />

              {slot.imageUrl ? (
                <>
                  <img
                    src={slot.imageUrl}
                    alt={slot.guideText}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                  {/* hover 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors group">
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <label
                        htmlFor={`upload-${slot.id}`}
                        className="cursor-pointer bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        교체
                      </label>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  {/* 드래그 핸들 */}
                  <div className="absolute top-2 left-2 bg-black/50 text-white rounded-md p-1 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3" />
                  </div>
                  {/* 슬롯 번호 */}
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                    {idx + 1}
                  </div>
                </>
              ) : (
                <label
                  htmlFor={`upload-${slot.id}`}
                  className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 cursor-pointer"
                >
                  {uploading === slot.id ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-blue-600 font-semibold">업로드 중...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="text-center px-1">
                        <div className="text-xs font-bold text-gray-400 mb-1">슬롯 {idx + 1}</div>
                        <div className="text-xs text-blue-600 font-semibold leading-relaxed line-clamp-3">
                          {slot.guideText}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5">
                        <Upload className="w-3 h-3" />
                        <span>사진 선택</span>
                      </div>
                    </>
                  )}
                </label>
              )}
            </div>
            {/* 업로드된 이미지의 표시 비율 선택 */}
            {slot.imageUrl && (
              <div className="flex flex-wrap gap-1 justify-center">
                {ASPECT_RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAspectRatioChange(slot.id, opt.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                      slot.aspectRatio === opt.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div className="bg-gray-100 rounded-xl px-5 py-3 text-xs text-gray-500 flex items-center gap-2">
          <span>📎</span>
          <span>JPG · PNG · GIF · WEBP 지원 / 파일당 최대 10MB / 슬롯 간 드래그로 위치 교체 가능</span>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {filledCount === 0
              ? "이미지 없이도 디자인 생성이 가능합니다"
              : `${filledCount}/${slots.length}개 업로드됨`}
          </p>
          {/* 이미 생성된 HTML 디자인이 있으면 "디자인 보기", 없으면 "생성하기" */}
          {session?.htmlDesign?.fullHtml ? (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!session) return;
                  // htmlDesign을 먼저 지워야 design 페이지가 재생성을 건너뛰지 않음
                  await updateDoc(doc(db, "sessions", session.id), { htmlDesign: null });
                  router.push(`/generate/design/${session.id}`);
                }}
                className="text-gray-500 font-semibold px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm whitespace-nowrap"
              >
                재생성
              </button>
              <button
                onClick={() => router.push(`/generate/preview-html/${session.id}`)}
                className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
              >
                디자인 보기 →
              </button>
            </div>
          ) : session?.designResult && (session.designResult as {sections: unknown[]}).sections?.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!session) return;
                  await updateDoc(doc(db, "sessions", session.id), { designResult: null });
                  router.push(`/generate/design/${session.id}`);
                }}
                className="text-gray-500 font-semibold px-4 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm whitespace-nowrap"
              >
                재생성
              </button>
              <button
                onClick={() => router.push(`/generate/preview/${session.id}`)}
                className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
              >
                디자인 보기 →
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push(`/generate/design/${sessionId}`)}
              className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
            >
              디자인 생성하기 ✦
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
