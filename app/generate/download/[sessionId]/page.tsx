"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DesignSection } from "@/lib/types";
import { getToneById, TONES } from "@/components/design-system/tones";
import { getAppliedFont } from "@/components/design-system/fonts";
import { DesignRenderer } from "@/components/design-renderer";
import { saveReview, markFreeTrialUsed, markReviewDone } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { wasReviewSkippedRecently, markReviewSkipped } from "@/lib/review-prompt";
import { ReviewModal } from "@/components/review-modal";
import { ArrowLeft, Download, CheckCircle } from "lucide-react";

const UPLOAD_KEY = "contie_upload_slots";

// html2canvas v1.4.x는 lab()/oklch() 등 CSS Color Level 4 색상 함수를 파싱하지 못한다.
// Tailwind v4 기본 팔레트가 이 포맷을 사용하므로, onclone 콜백에서 Canvas API로 sRGB 변환한다.
const MODERN_COLOR_RE = /\b(?:ok)?(?:lab|lch)\s*\(|oklch\s*\(/i;
const COLOR_PROPS = [
  "color", "background-color",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "outline-color", "text-decoration-color",
];

let _toRgbCtx: CanvasRenderingContext2D | null = null;
const _toRgbCache = new Map<string, string>();

function getToRgbCtx(): CanvasRenderingContext2D | null {
  if (_toRgbCtx) return _toRgbCtx;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    _toRgbCtx = c.getContext("2d", { willReadFrequently: true });
  } catch {}
  return _toRgbCtx;
}

function toRgb(color: string): string {
  if (_toRgbCache.has(color)) return _toRgbCache.get(color)!;
  const ctx = getToRgbCtx();
  if (!ctx) return color;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const result = a < 255 ? `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})` : `rgb(${r},${g},${b})`;
    _toRgbCache.set(color, result);
    return result;
  } catch {
    return color;
  }
}

function fixModernColors(_clonedDoc: Document, clonedEl: HTMLElement): void {
  [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
    try {
      const cs = window.getComputedStyle(el);
      COLOR_PROPS.forEach((prop) => {
        const val = cs.getPropertyValue(prop);
        if (val && MODERN_COLOR_RE.test(val)) {
          el.style.setProperty(prop, toRgb(val), "important");
        }
      });
    } catch { /* skip */ }
  });
}

interface DownloadStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export default function DownloadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const [sections, setSections] = useState<DesignSection[]>([]);
  const [toneId, setToneId] = useState("minimal");
  const [fontChoice, setFontChoice] = useState("recommended");
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [productName, setProductName] = useState("상세페이지");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<DownloadStep[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [freeTrialUsed, setFreeTrialUsed] = useState(true);
  const [designReviewEligible, setDesignReviewEligible] = useState(false);
  const [replayKeys, setReplayKeys] = useState<number[]>([]);
  const rendererRef = useRef<HTMLDivElement>(null);

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

    setToneId(data.selectedTone ?? "minimal");
    setFontChoice(data.fontChoice ?? "recommended");
    setProductName(data.productName ?? "상세페이지");
    if (data.designResult?.sections?.length) {
      setSections(data.designResult.sections);
      setReplayKeys(new Array(data.designResult.sections.length).fill(0));
    }
    // users 컬렉션에서 freeTrialUsed / 디자인 후기 작성 여부 조회
    if (isAdminEmail(user!.email)) {
      setFreeTrialUsed(false);
      setDesignReviewEligible(false);
    } else {
      const userSnap = await getDoc(doc(db, "users", user!.uid));
      if (userSnap.exists()) {
        setFreeTrialUsed(userSnap.data().freeTrialUsed === true);
        const designReviewDone = userSnap.data().designReviewDone === true;
        setDesignReviewEligible(!designReviewDone && !wasReviewSkippedRecently("design"));
      } else {
        setFreeTrialUsed(false);
        setDesignReviewEligible(!wasReviewSkippedRecently("design"));
      }
    }
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

  async function handleDownloadClick() {
    // 무료 체험 미사용자 또는 디자인 후기 미작성자 → 후기 모달 먼저
    if (!freeTrialUsed || designReviewEligible) {
      setShowReviewModal(true);
      return;
    }
    await runDownload();
  }

  async function handleReviewSubmit(star: number, text: string) {
    setShowReviewModal(false);
    if (user) {
      await saveReview(user.uid, star, text, "design", sessionId).catch(() => {});
      await markReviewDone(user.uid, "design").catch(() => {});
      setDesignReviewEligible(false);
      if (!freeTrialUsed && !isAdminEmail(user.email)) {
        await markFreeTrialUsed(user.uid).catch(() => {});
        setFreeTrialUsed(true);
      }
    }
    await runDownload();
  }

  async function handleReviewSkip() {
    setShowReviewModal(false);
    markReviewSkipped("design");
    setDesignReviewEligible(false);
    if (user && !freeTrialUsed && !isAdminEmail(user.email)) {
      await markFreeTrialUsed(user.uid).catch(() => {});
      setFreeTrialUsed(true);
    }
    await runDownload();
  }

  async function runDownload() {
    if (!rendererRef.current || downloading) return;
    setDownloading(true);
    setDone(false);

    const [html2canvas, JSZip] = await Promise.all([
      import("html2canvas").then((m) => m.default),
      import("jszip").then((m) => m.default),
    ]);

    const sectionEls = rendererRef.current.querySelectorAll("[data-section-id]");
    const total = sectionEls.length;

    const initialSteps: DownloadStep[] = [
      { label: "디자인 렌더링 준비", status: "running" },
      ...Array.from({ length: total }, (_, i) => ({
        label: `섹션 ${i + 1} 캡처`,
        status: "pending" as const,
      })),
      { label: "ZIP 패키징", status: "pending" },
      { label: "다운로드 시작", status: "pending" },
    ];
    setSteps(initialSteps);

    const zip = new JSZip();
    const folder = zip.folder("design") ?? zip;

    // Step 0: ready
    setSteps((prev) => prev.map((s, i) => i === 0 ? { ...s, status: "done" } : s));

    // Capture each section
    for (let i = 0; i < sectionEls.length; i++) {
      const el = sectionEls[i] as HTMLElement;
      const section = sections[i];

      setSteps((prev) =>
        prev.map((s, idx) => idx === i + 1 ? { ...s, status: "running" } : s)
      );

      try {
        const hasMotion = !!section?.motionTemplate;

        if (hasMotion) {
          // 모션을 처음부터 다시 재생시켜, GIF 프레임 캡처 중에 실제로 움직이는 모습을 담는다.
          setReplayKeys((prev) => prev.map((v, idx) => (idx === i ? v + 1 : v)));
          await new Promise((r) => setTimeout(r, 200));

          // GIF: capture ~10 frames over 800ms
          const GIF = (await import("gif.js")).default;
          const gif = new GIF({
            workers: 2,
            quality: 10,
            width: el.offsetWidth,
            height: el.offsetHeight,
            workerScript: "/gif.worker.js",
            globalPalette: true,
          } as ConstructorParameters<typeof GIF>[0]);

          // Frame capture loop
          for (let f = 0; f < 10; f++) {
            await new Promise((r) => setTimeout(r, 80));
            const canvas = await html2canvas(el, { scale: 1, useCORS: true, logging: false, onclone: fixModernColors });
            gif.addFrame(canvas, { delay: 80, copy: true });
          }

          await new Promise<void>((resolve) => {
            gif.on("finished", (blob: Blob) => {
              folder.file(`section_${String(i + 1).padStart(2, "0")}_motion.gif`, blob);
              resolve();
            });
            gif.on("abort", () => resolve());
            gif.render();
          });
        } else {
          // PNG: single capture
          const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, onclone: fixModernColors });
          const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
          );
          folder.file(`section_${String(i + 1).padStart(2, "0")}.png`, blob);
        }

        setSteps((prev) =>
          prev.map((s, idx) => idx === i + 1 ? { ...s, status: "done" } : s)
        );
      } catch (err) {
        console.error(`Section ${i + 1} capture error:`, err);
        // fallback: PNG only
        try {
          const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, onclone: fixModernColors });
          const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
          );
          folder.file(`section_${String(i + 1).padStart(2, "0")}.png`, blob);
        } catch {}
        setSteps((prev) =>
          prev.map((s, idx) => idx === i + 1 ? { ...s, status: "done" } : s)
        );
      }
    }

    // ZIP 패키징
    setSteps((prev) =>
      prev.map((s, i) => i === total + 1 ? { ...s, status: "running" } : s)
    );
    const zipBlob = await zip.generateAsync({ type: "blob" });
    setSteps((prev) =>
      prev.map((s, i) => i === total + 1 ? { ...s, status: "done" } : s)
    );

    // 다운로드
    setSteps((prev) =>
      prev.map((s, i) => i === total + 2 ? { ...s, status: "running" } : s)
    );
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName}_디자인.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setSteps((prev) =>
      prev.map((s, i) => i === total + 2 ? { ...s, status: "done" } : s)
    );

    setDownloading(false);
    setDone(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">로딩 중...</div>
      </div>
    );
  }

  const tone = getToneById(toneId) ?? TONES[4];
  const fontFamily = getAppliedFont(toneId, fontChoice);

  return (
    <div className="min-h-screen bg-gray-50">
      {showReviewModal && (
        <ReviewModal
          onSubmit={handleReviewSubmit}
          onSkip={handleReviewSkip}
          title="디자인 완성, 어떠셨나요?"
          description={"완성된 디자인에 대한 솔직한 후기를 들려주세요.\n서비스 개선에 큰 도움이 됩니다."}
          submitLabel="후기 남기고 다운로드"
          skipLabel="건너뛰고 다운로드"
        />
      )}
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={`/generate/preview/${sessionId}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> 미리보기로
          </Link>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            디자인 생성 ✦ 다운로드
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* 왼쪽: 다운로드 패널 */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-20">
            <h2 className="font-black text-gray-900 text-lg mb-1">PNG + GIF 다운로드</h2>
            <p className="text-xs text-gray-500 mb-5">
              섹션별 PNG 이미지와 모션 GIF를<br />ZIP으로 묶어 다운로드합니다.
            </p>

            {/* 진행 상태 */}
            {steps.length > 0 && (
              <div className="space-y-2 mb-5">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 shrink-0 ${
                      step.status === "done" ? "text-green-500" :
                      step.status === "running" ? "text-blue-500 animate-pulse" :
                      step.status === "error" ? "text-red-500" :
                      "text-gray-300"
                    }`}>
                      {step.status === "done" ? "✓" :
                       step.status === "running" ? "→" :
                       step.status === "error" ? "✕" : "○"}
                    </span>
                    <span className={
                      step.status === "done" ? "text-gray-700" :
                      step.status === "running" ? "text-blue-600 font-semibold" :
                      "text-gray-400"
                    }>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {done ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="text-sm font-bold text-gray-900 text-center">다운로드 완료!</p>
                <button
                  onClick={handleDownloadClick}
                  className="w-full text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg py-2 hover:bg-gray-50"
                >
                  다시 다운로드
                </button>
              </div>
            ) : (
              <button
                onClick={handleDownloadClick}
                disabled={downloading || sections.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    다운로드 시작
                  </>
                )}
              </button>
            )}

            <p className="text-xs text-gray-400 text-center mt-3">
              {sections.filter(s => s.motionTemplate).length}개 GIF + {sections.filter(s => !s.motionTemplate).length}개 PNG
            </p>
          </div>
        </div>

        {/* 오른쪽: 렌더러 (캡처 대상) */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-3 text-center">캡처 미리보기 (750px 기준)</p>
          <div
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: tone.background, fontFamily }}
          >
            <div ref={rendererRef}>
              {sections.map((section, i) => {
                const imageUrl =
                  section.imageSlotIndex !== null
                    ? (assets[`placeholder_${section.imageSlotIndex}`] ?? null)
                    : null;
                return (
                  <div key={section.id} data-section-id={section.id}>
                    <DesignRenderer
                      sections={[section]}
                      toneId={toneId}
                      fontChoice={fontChoice}
                      assets={assets}
                      motionEnabled={true}
                      replayKey={replayKeys[i]}
                    />
                    <div className="h-px bg-black/5" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
