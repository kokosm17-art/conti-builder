"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ensureShareId, reactivateSession, saveHtmlDesignEdit } from "@/lib/session";
import { useReviewGate } from "@/lib/use-review-gate";
import { ReviewModal } from "@/components/review-modal";
import { ArrowLeft, RefreshCw, Download, Link2, Pencil, Image as ImageIcon, X } from "lucide-react";

const UPLOAD_KEY = "contie_upload_slots";
const GREY_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface SectionMeta {
  id: string;
  label: string;
  slotId: string | null;
}

// ─── DOM 유틸 ─────────────────────────────────────────────────────────────────

function parseSectionMetas(fullHtml: string, sectionIds: string[]): SectionMeta[] {
  if (typeof window === "undefined" || !fullHtml) {
    return sectionIds.map((id, i) => ({ id, label: `섹션 ${i + 1}`, slotId: null }));
  }
  const parser = new DOMParser();
  const domDoc = parser.parseFromString(fullHtml, "text/html");
  return sectionIds.map((id, i) => {
    const sec = domDoc.querySelector(`#${id}`);
    const rawText = sec?.textContent?.trim().replace(/\s+/g, " ") ?? "";
    const label = rawText ? rawText.substring(0, 30) + (rawText.length > 30 ? "…" : "") : `섹션 ${i + 1}`;
    const imgEl = sec?.querySelector("img[data-slot]");
    return { id, label, slotId: imgEl?.getAttribute("data-slot") ?? null };
  });
}

function extractSectionHtml(fullHtml: string, sectionId: string): string {
  const parser = new DOMParser();
  const domDoc = parser.parseFromString(fullHtml, "text/html");
  return domDoc.querySelector(`#${sectionId}`)?.outerHTML ?? "";
}

function replaceSectionInHtml(fullHtml: string, sectionId: string, newSectionHtml: string): string {
  const parser = new DOMParser();
  const domDoc = parser.parseFromString(fullHtml, "text/html");
  const target = domDoc.querySelector(`#${sectionId}`);
  if (!target) return fullHtml;
  const wrapper = domDoc.createElement("div");
  wrapper.innerHTML = newSectionHtml;
  const replacement = wrapper.firstElementChild;
  if (!replacement) return fullHtml;
  target.replaceWith(replacement);
  return "<!DOCTYPE html>" + domDoc.documentElement.outerHTML;
}

/**
 * fullHtml에 인터랙티브 오버레이 추가:
 * - 이미지 슬롯: 클릭 가능한 placeholder(카메라 아이콘 + 설명) + postMessage
 * - 각 섹션: 우측 상단 [✏ 수정] 버튼(hover 시 표시) + postMessage
 */
function buildInteractiveHtml(html: string): string {
  if (!html || typeof window === "undefined") return html;
  const parser = new DOMParser();
  const domDoc = parser.parseFromString(html, "text/html");

  // 오버레이 전용 CSS (기존 디자인 CSS와 충돌 방지)
  const style = domDoc.createElement("style");
  style.id = "ci-overlay-styles";
  style.textContent = `
    .ci-wrap{position:relative;display:block;cursor:pointer;}
    .ci-ph{
      position:absolute;inset:0;min-height:160px;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
      background:#f1f2f5;border:2px dashed #c9cdd4;z-index:5;
      transition:background .15s;
    }
    .ci-ph:hover{background:#e4e6ec;}
    .ci-ph.ci-done{display:none!important;}
    .ci-ph-icon{color:#94a3b8;}
    .ci-ph-label{font-size:13px;font-weight:700;color:#4b5563;font-family:sans-serif;}
    .ci-ph-desc{font-size:11px;color:#94a3b8;text-align:center;padding:0 20px;line-height:1.5;font-family:sans-serif;max-width:240px;}
    .ci-chg{
      position:absolute;bottom:10px;right:10px;
      background:rgba(0,0,0,.58);color:#fff;border:none;border-radius:7px;
      padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer;
      display:flex;align-items:center;gap:5px;z-index:6;
      opacity:0;transition:opacity .2s;font-family:sans-serif;
    }
    .ci-wrap:hover .ci-chg{opacity:1;}
    section{position:relative!important;}
    .ci-edit-btn{
      position:absolute;top:10px;right:10px;
      background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;
      padding:5px 12px;font-size:11px;font-weight:700;color:#374151;
      cursor:pointer;display:flex;align-items:center;gap:5px;
      box-shadow:0 2px 8px rgba(0,0,0,.08);z-index:10;
      opacity:0;transition:opacity .2s;pointer-events:auto;
      font-family:sans-serif;
    }
    section:hover>.ci-edit-btn{opacity:1;}
  `;
  domDoc.head.appendChild(style);

  // 이미지 슬롯 처리
  domDoc.querySelectorAll("img[data-slot]").forEach((el) => {
    const img = el as HTMLImageElement;
    const slotId = img.getAttribute("data-slot") ?? "";
    const desc = img.getAttribute("alt") || "이미지 영역";

    // wrapper div
    const wrap = domDoc.createElement("div");
    wrap.className = "ci-wrap";
    wrap.setAttribute("data-slot-wrap", slotId);

    // placeholder overlay
    const ph = domDoc.createElement("div");
    ph.className = "ci-ph";
    ph.innerHTML = `
      <svg class="ci-ph-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <span class="ci-ph-label">사진 추가</span>
      <span class="ci-ph-desc">${desc}</span>
    `;

    // 변경 버튼 (이미지 있을 때 hover)
    const chgBtn = domDoc.createElement("button");
    chgBtn.className = "ci-chg";
    chgBtn.setAttribute("data-slot-chg", slotId);
    chgBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>사진 변경`;

    img.parentNode?.insertBefore(wrap, img);
    wrap.appendChild(img);
    wrap.appendChild(ph);
    wrap.appendChild(chgBtn);
    // img는 placeholder 뒤에 있어야 placeholder가 덮을 수 있음
    img.style.cssText = "width:100%;display:block;object-fit:cover;position:relative;z-index:1;";
  });

  // 섹션마다 [수정] 버튼 추가
  domDoc.querySelectorAll("section[id]").forEach((sec) => {
    const btn = domDoc.createElement("button");
    btn.className = "ci-edit-btn";
    btn.setAttribute("data-edit-sec", sec.id);
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>수정`;
    sec.appendChild(btn);
  });

  // postMessage 스크립트 주입
  const script = domDoc.createElement("script");
  script.textContent = `
(function(){
  function slotMsg(id){ window.parent.postMessage({type:'SLOT_CLICK',slotId:id},'*'); }

  document.querySelectorAll('[data-slot-wrap]').forEach(function(el){
    var id=el.getAttribute('data-slot-wrap');
    el.querySelector('.ci-ph').addEventListener('click',function(){ slotMsg(id); });
  });
  document.querySelectorAll('[data-slot-chg]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      slotMsg(btn.getAttribute('data-slot-chg'));
    });
  });
  document.querySelectorAll('[data-edit-sec]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      window.parent.postMessage({type:'EDIT_CLICK',sectionId:btn.getAttribute('data-edit-sec')},'*');
    });
  });

  // 부모로부터 이미지 데이터 수신
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='IMAGE_DATA') return;
    var slotId=e.data.slotId;
    var wrap=document.querySelector('[data-slot-wrap="'+slotId+'"]');
    if(!wrap) return;
    var img=wrap.querySelector('img[data-slot="'+slotId+'"]');
    var ph=wrap.querySelector('.ci-ph');
    if(img) img.src=e.data.dataUrl;
    if(ph) ph.classList.add('ci-done');
  });
})();
`;
  domDoc.body.appendChild(script);

  return "<!DOCTYPE html>" + domDoc.documentElement.outerHTML;
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function PreviewHtmlPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [fullHtml, setFullHtml] = useState("");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [sectionMetas, setSectionMetas] = useState<SectionMeta[]>([]);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [toneId, setToneId] = useState("minimal");
  const [designEditCount, setDesignEditCount] = useState(0);
  const [designGenCount, setDesignGenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 편집 패널 상태
  const [editingMeta, setEditingMeta] = useState<SectionMeta | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const reviewGate = useReviewGate(user?.uid, "design");

  // ── 데이터 로드 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    // sessionId가 바뀔 때 loading을 다시 true로 돌리지 않으면, 새 세션 데이터를
    // 불러오는 동안 이전 세션의 콘텐츠와 재생성/수정 버튼이 그대로 남아 클릭
    // 가능한 상태가 되어, 이전 세션 데이터로 재생성한 결과가 새 세션에 저장되는
    // 문제가 생길 수 있다 (app/generate/conti/[sessionId]/page.tsx와 동일한 버그).
    let ignore = false;
    setLoading(true);
    loadSession(ignore);
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, sessionId]);

  async function loadSession(ignore = false) {
    const snap = await getDoc(doc(db, "sessions", sessionId));
    if (ignore) return;
    if (!snap.exists()) { router.push("/generate"); return; }
    const data = snap.data();
    if (data.userId !== user!.uid) { router.push("/generate"); return; }

    setToneId(data.selectedTone ?? "minimal");
    setDesignEditCount(data.designEditCount ?? 0);
    setDesignGenCount(data.designGenCount ?? 0);

    const html: string = data.htmlDesign?.fullHtml ?? "";
    const ids: string[] = data.htmlDesign?.sectionIds ?? [];
    setFullHtml(html);
    setSectionIds(ids);

    let loadedAssets: Record<string, string> = {};
    try {
      const saved = sessionStorage.getItem(UPLOAD_KEY);
      if (saved) {
        const slots: { id: string; imageUrl: string | null }[] = JSON.parse(saved);
        slots.forEach((s) => { if (s.imageUrl) loadedAssets[s.id] = s.imageUrl; });
      } else if (data.assets) {
        loadedAssets = data.assets;
      }
    } catch {
      if (data.assets) loadedAssets = data.assets;
    }
    setAssets(loadedAssets);
    setLoading(false);
  }

  useEffect(() => {
    if (fullHtml && sectionIds.length > 0) {
      setSectionMetas(parseSectionMetas(fullHtml, sectionIds));
    }
  }, [fullHtml, sectionIds]);

  // ── 인터랙티브 HTML (오버레이 포함, 이미지 제외) ─────────────────────────

  const interactiveHtml = useMemo(
    () => (fullHtml ? buildInteractiveHtml(fullHtml) : ""),
    [fullHtml]
  );

  // ── iframe onLoad: 기존 이미지 전송 ──────────────────────────────────────

  const sendImagesToIframe = useCallback((assetsMap: Record<string, string>) => {
    const cw = iframeRef.current?.contentWindow;
    if (!cw) return;
    Object.entries(assetsMap).forEach(([slotId, dataUrl]) => {
      cw.postMessage({ type: "IMAGE_DATA", slotId, dataUrl }, "*");
    });
  }, []);

  const adjustIframeHeight = useCallback(() => {
    try {
      const h = iframeRef.current?.contentDocument?.body?.scrollHeight;
      if (h && h > 200 && iframeRef.current) iframeRef.current.style.height = `${h + 80}px`;
    } catch {}
  }, []);

  function handleIframeLoad() {
    adjustIframeHeight();
    sendImagesToIframe(assets);
  }

  // ── postMessage 수신 ─────────────────────────────────────────────────────

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.data) return;

      if (e.data.type === "SLOT_CLICK") {
        const slotId = e.data.slotId as string;
        // 해당 슬롯이 속한 섹션 찾기 (없으면 임시 메타 생성)
        const meta = sectionMetas.find((m) => m.slotId === slotId) ?? {
          id: "",
          label: "이미지 영역",
          slotId,
        };
        setEditingMeta(meta);
        setEditInstruction("");
      }

      if (e.data.type === "EDIT_CLICK") {
        const sectionId = e.data.sectionId as string;
        const meta = sectionMetas.find((m) => m.id === sectionId);
        if (meta) {
          setEditingMeta(meta);
          setEditInstruction("");
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [sectionMetas]);

  // ── 이미지 업로드 ────────────────────────────────────────────────────────

  function handleImageUpload(slotId: string, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAssets((prev) => ({ ...prev, [slotId]: base64 }));

      // iframe에 직접 전송 (리로드 없이 in-place 업데이트)
      iframeRef.current?.contentWindow?.postMessage(
        { type: "IMAGE_DATA", slotId, dataUrl: base64 },
        "*"
      );

      try {
        const saved = sessionStorage.getItem(UPLOAD_KEY);
        const slots: { id: string; imageUrl: string | null }[] = saved ? JSON.parse(saved) : [];
        const idx = slots.findIndex((s) => s.id === slotId);
        if (idx >= 0) slots[idx] = { ...slots[idx], imageUrl: base64 };
        else slots.push({ id: slotId, imageUrl: base64 });
        sessionStorage.setItem(UPLOAD_KEY, JSON.stringify(slots));
      } catch {}

      try {
        await updateDoc(doc(db, "sessions", sessionId), { [`assets.${slotId}`]: base64 });
      } catch {}
    };
    reader.readAsDataURL(file);
  }

  // ── 섹션 AI 수정 ─────────────────────────────────────────────────────────

  async function handleSectionEdit() {
    if (!editingMeta || !editingMeta.id) return;
    if (designEditCount >= 30) { alert("디자인 수정 횟수(최대 30회)를 모두 사용하셨습니다."); return; }
    const instruction = editInstruction.trim();
    if (!instruction) return;

    const sectionHtml = extractSectionHtml(fullHtml, editingMeta.id);
    if (!sectionHtml) { alert("섹션을 찾을 수 없습니다."); return; }

    setEditLoading(true);
    try {
      const res = await fetch("/api/design/edit-section-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionHtml, instruction, toneId }),
      });
      if (!res.ok) throw new Error("수정 실패");
      const { sectionHtml: updatedHtml } = await res.json();

      const newFullHtml = replaceSectionInHtml(fullHtml, editingMeta.id, updatedHtml);
      setFullHtml(newFullHtml);
      setSectionMetas(parseSectionMetas(newFullHtml, sectionIds));
      setIframeKey((k) => k + 1); // 섹션 수정 후 iframe 재마운트

      await saveHtmlDesignEdit(sessionId, newFullHtml, designEditCount);
      setDesignEditCount((c) => c + 1);
      closePanel();
    } catch {
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setEditLoading(false);
    }
  }

  function closePanel() {
    setEditingMeta(null);
    setEditInstruction("");
  }

  // ── 전체 재생성 ──────────────────────────────────────────────────────────

  async function handleFullRegen() {
    if (designGenCount >= 5) { alert("재생성 횟수(최대 5회)를 모두 사용하셨습니다."); return; }
    if (!confirm("전체 디자인을 다시 생성할까요? 현재 디자인이 교체됩니다.")) return;
    if (!user) return;
    try {
      await reactivateSession(user.uid, sessionId);
      await updateDoc(doc(db, "sessions", sessionId), { htmlDesign: null });
      router.push("/generate/design");
    } catch {
      alert("재생성 준비 중 오류가 발생했습니다.");
    }
  }

  async function handleShareCopy() {
    try {
      const shareId = await ensureShareId(sessionId);
      await navigator.clipboard.writeText(`${window.location.origin}/preview/${shareId}`);
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── 다운로드: 오버레이 없이 이미지 주입된 순수 HTML ──────────────────────

  function handleDownload() {
    const parser = new DOMParser();
    const domDoc = parser.parseFromString(fullHtml, "text/html");

    // 업로드된 이미지 주입
    Object.entries(assets).forEach(([slotId, dataUrl]) => {
      const img = domDoc.querySelector(`img[data-slot="${slotId}"]`);
      if (img) img.setAttribute("src", dataUrl);
    });

    // 미업로드 슬롯 → 회색 placeholder
    domDoc.querySelectorAll("img[data-slot]").forEach((el) => {
      const img = el as HTMLImageElement;
      if (!img.getAttribute("src")) {
        img.setAttribute("src", GREY_GIF);
        img.setAttribute("style", "background:#e5e7eb;min-height:200px;display:block;width:100%;object-fit:none;");
      }
    });

    const finalHtml = "<!DOCTYPE html>" + domDoc.documentElement.outerHTML;
    const blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wadiz-design-${sessionId.substring(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-semibold">미리보기 불러오는 중...</div>
      </div>
    );
  }

  if (!fullHtml) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">디자인 결과가 없습니다.</p>
        <button onClick={() => router.push("/generate/design")} className="bg-blue-600 text-white font-bold px-6 py-2 rounded-xl">
          디자인 생성하기
        </button>
      </div>
    );
  }

  const remainingEdit = Math.max(0, 30 - designEditCount);
  const remainingRegen = Math.max(0, 5 - designGenCount);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {reviewGate.showModal && (
        <ReviewModal
          onSubmit={(star, text) => reviewGate.handleSubmit(star, text, sessionId)}
          onSkip={reviewGate.handleSkip}
          title="디자인 완성, 어떠셨나요?"
          description={"완성된 디자인에 대한 솔직한 후기를 들려주세요.\n서비스 개선에 큰 도움이 됩니다."}
        />
      )}

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-[820px] mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => reviewGate.guardedNavigate(() => router.push("/generate/upload"))}
            className="shrink-0 text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm font-semibold mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
            AI 디자인
          </span>

          <span className="text-xs text-gray-400 shrink-0 hidden sm:inline ml-1">
            수정 {remainingEdit}/30
          </span>

          <div className="flex-1" />

          <button
            onClick={handleFullRegen}
            disabled={remainingRegen <= 0}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">재생성 ({remainingRegen}/5)</span>
          </button>

          <button
            onClick={handleShareCopy}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            {copied ? "복사됨 ✓" : <span className="hidden sm:inline">링크 복사</span>}
          </button>

          <button
            onClick={handleDownload}
            className="shrink-0 flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>다운로드</span>
          </button>
        </div>
      </header>

      {/* ── 미리보기 (전체 너비) ── */}
      <main className="flex-1 py-6 px-4 overflow-auto">
        <div className="max-w-[780px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-white">
          <iframe
            ref={iframeRef}
            key={iframeKey}
            srcDoc={interactiveHtml}
            style={{ width: "100%", height: "3000px", border: "none", display: "block" }}
            title="디자인 미리보기"
            onLoad={handleIframeLoad}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
          이미지 영역을 클릭해 사진을 추가하거나, 섹션 위에 마우스를 올리면 나타나는{" "}
          <strong className="font-semibold text-gray-500">수정</strong> 버튼으로 내용을 편집할 수 있어요.
        </p>
      </main>

      {/* ── 편집 패널 (하단 슬라이드업) ── */}
      {editingMeta && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* 딤 배경 */}
          <div
            className="absolute inset-0 bg-black/25"
            onClick={closePanel}
          />

          {/* 패널 본체 */}
          <div
            className="relative w-full max-w-[780px] mx-auto bg-white rounded-t-2xl shadow-2xl border-t border-gray-100 px-5 pt-5 pb-8 space-y-5"
            style={{ animation: "none" }}
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-widest mb-0.5">
                  섹션 편집
                </p>
                <p className="text-sm font-bold text-gray-900 truncate">{editingMeta.label}</p>
              </div>
              <button
                onClick={closePanel}
                className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 이미지 업로드 (슬롯 있는 섹션만) */}
            {editingMeta.slotId && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">사진</p>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-blue-100 transition-colors select-none">
                  <ImageIcon className="w-4 h-4" />
                  {assets[editingMeta.slotId] ? "사진 변경" : "사진 추가"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && editingMeta.slotId) handleImageUpload(editingMeta.slotId, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            {/* AI 수정 */}
            {editingMeta.id && (
              remainingEdit > 0 ? (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                    <Pencil className="w-3 h-3" />
                    AI 수정 ({remainingEdit}회 남음)
                  </p>
                  <textarea
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    placeholder="예: 문구를 더 짧고 강하게  /  배경색을 어둡게  /  이미지를 더 크게"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none bg-gray-50 placeholder:text-gray-400"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSectionEdit();
                    }}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={closePanel}
                      className="flex-1 text-sm font-semibold py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      닫기
                    </button>
                    <button
                      onClick={handleSectionEdit}
                      disabled={editLoading || !editInstruction.trim()}
                      className="flex-[2] text-sm font-bold py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {editLoading ? "수정 중..." : "AI 수정 적용"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">AI 수정 횟수(30회)를 모두 사용하셨습니다.</p>
              )
            )}

            {/* 슬롯만 클릭했고 섹션 수정은 없는 경우 닫기 버튼 */}
            {!editingMeta.id && (
              <button
                onClick={closePanel}
                className="w-full text-sm font-semibold py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
