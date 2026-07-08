import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;

/** 제품명 → 단순 해시 (비교용) */
export function hashProduct(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/** 현재 유저의 활성 세션 조회 */
export async function getActiveSession(userId: string) {
  const q = query(
    collection(db, "sessions"),
    where("userId", "==", userId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const data = docSnap.data();

  // 만료 확인 (시간 제한이 있었던 이전 하위 호환 세션에 대해서만 만료 체크 적용)
  if (data.expiresAt) {
    const expiresAt = (data.expiresAt as Timestamp).toMillis();
    if (Date.now() > expiresAt) {
      await updateDoc(doc(db, "sessions", docSnap.id), { status: "expired" });
      return null;
    }
  }

  return {
    id: docSnap.id,
    productName: data.productName as string,
    productHash: data.productHash as string,
    status: data.status as string,
    generationCount: data.generationCount as number,
    userId: data.userId as string,
    
    // 신규 이원화 카운터
    contiGenCount: data.contiGenCount ?? 0,
    contiEditCount: data.contiEditCount ?? 0,
    designGenCount: data.designGenCount ?? 0,
    designEditCount: data.designEditCount ?? 0,
    
    // 신규 디자인 설정
    contiText: data.contiText as string | undefined,
    contiDraft: data.contiDraft as string | undefined,
    formDraft: data.formDraft as import("./types").FormData | undefined,
    formStep: data.formStep as number | undefined,
    selectedTone: data.selectedTone as string | undefined,
    fontChoice: data.fontChoice as string | undefined,
    shareId: data.shareId as string | undefined,
    assets: data.assets as Record<string, string> | undefined,
    designResult: data.designResult as import("./types").DesignResult | undefined,
    htmlDesign: data.htmlDesign as import("./types").HtmlDesignResult | undefined,
    motionEnabled: data.motionEnabled as boolean | undefined,
    feedbackStar: data.feedbackStar as number | undefined,
    feedbackText: data.feedbackText as string | undefined,
    sectionRegenCount: data.sectionRegenCount ?? 0,
  };
}

/** 새 세션 생성 */
export async function createSession(userId: string, productName: string) {
  const ref = await addDoc(collection(db, "sessions"), {
    userId,
    productName,
    productHash: hashProduct(productName),
    createdAt: serverTimestamp(),
    status: "active",
    generationCount: 0,
    
    // 신규 이원화 카운터 초기화
    contiGenCount: 0,
    contiEditCount: 0,
    designGenCount: 0,
    designEditCount: 0,
    
    // 디자인 설정 초기값
    selectedTone: "",
    fontChoice: "recommended",
    shareId: "",
    assets: {},
    designResult: null,
    motionEnabled: true,
    sectionRegenCount: 0,
  });
  return ref.id;
}

/** 유저의 전체 세션 기록 조회 (마이페이지 — 상태 무관, 최신순으로 정렬해 반환) */
export async function getAllSessions(userId: string) {
  const q = query(collection(db, "sessions"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const sessions = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      productName: data.productName as string,
      status: data.status as string,
      createdAt: data.createdAt as Timestamp | undefined,
      contiText: data.contiText as string | undefined,
      contiDraft: data.contiDraft as string | undefined,
      designResult: data.designResult as import("./types").DesignResult | undefined,
      htmlDesignExists: !!(data.htmlDesign?.fullHtml),
      formStep: data.formStep as number | undefined,
    };
  });
  // where + orderBy 조합은 복합 인덱스가 필요해, 클라이언트에서 정렬한다
  sessions.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return sessions;
}

/**
 * 마이페이지에서 과거 기록을 "이어서 작성"할 때 호출.
 * 한 유저는 활성 세션을 하나만 가질 수 있으므로, 현재 활성 세션이 대상과 다르면
 * 그 세션은 보관(만료) 처리하고 선택한 세션을 다시 활성화한다.
 */
export async function reactivateSession(userId: string, targetSessionId: string) {
  const current = await getActiveSession(userId);
  if (current?.id === targetSessionId) return;
  if (current) {
    await updateDoc(doc(db, "sessions", current.id), { status: "expired" });
  }
  // 레거시 세션에 남아있는 expiresAt이 과거 시점이면 재활성화 직후
  // getActiveSession의 만료 체크가 곧바로 다시 만료시켜 버리므로 함께 제거한다
  // (현재 정책은 시간 제한이 없으므로 신규 세션과 동일하게 expiresAt 없이 둔다)
  await updateDoc(doc(db, "sessions", targetSessionId), {
    status: "active",
    expiresAt: deleteField(),
  });
}

/**
 * 홈페이지 "콘티 제작 시작하기" 등으로 새 작성을 시작할 때 호출.
 * 기존 활성 세션이 있다면 보관(만료) 처리해 마이페이지 기록으로 남기고,
 * 비어있는 새 세션을 만들어 반환한다.
 */
export async function startNewSession(userId: string) {
  const current = await getActiveSession(userId);
  if (current) {
    await updateDoc(doc(db, "sessions", current.id), { status: "expired" });
  }
  return createSession(userId, "");
}

/** 작성 기록 삭제 (마이페이지) */
export async function deleteSession(sessionId: string) {
  await deleteDoc(doc(db, "sessions", sessionId));
}

/** 세션 수정 횟수 증가 (하위 호환용) */
export async function incrementGeneration(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { generationCount: (snap.data().generationCount ?? 0) + 1 });
}

/** 콘티 재생성 횟수 증가 */
export async function incrementContiGen(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { 
    contiGenCount: (snap.data().contiGenCount ?? 0) + 1,
    generationCount: (snap.data().generationCount ?? 0) + 1,
  });
}

/** 콘티 수정 횟수 증가 */
export async function incrementContiEdit(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { 
    contiEditCount: (snap.data().contiEditCount ?? 0) + 1,
    generationCount: (snap.data().generationCount ?? 0) + 1,
  });
}

/** 디자인 재생성 횟수 증가 */
export async function incrementDesignGen(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { designGenCount: (snap.data().designGenCount ?? 0) + 1 });
}

/** 디자인 수정 횟수 증가 */
export async function incrementDesignEdit(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { designEditCount: (snap.data().designEditCount ?? 0) + 1 });
}

/** 콘티 생성 결과 텍스트 저장 (이미지 슬롯 파싱용) — 성공 시 임시 보관본은 정리 */
export async function saveContiText(sessionId: string, contiText: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { contiText, contiDraft: null });
}

/** 생성/수정 도중 오류가 나도 그때까지 만들어진 텍스트를 보존 (복구용) */
export async function saveContiDraft(sessionId: string, draftText: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { contiDraft: draftText });
}

/** 작성 중인 폼 입력 임시저장 (단계 전환 시 — 브라우저 저장소 유실 대비) */
export async function saveFormDraft(
  sessionId: string,
  formData: import("./types").FormData,
  step: number
) {
  const ref = doc(db, "sessions", sessionId);
  const update: Record<string, unknown> = { formDraft: formData, formStep: step };
  // 마이페이지 목록에 작성 중인 제품명이 보이도록 대표 필드도 함께 갱신
  if (formData.productName) {
    update.productName = formData.productName;
    update.productHash = hashProduct(formData.productName);
  }
  await updateDoc(ref, update);
}

/** 디자인 톤 선택 저장 */
export async function updateDesignTone(sessionId: string, tone: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { selectedTone: tone });
}

/** 이미지 에셋 정보 저장 */
export async function updateDesignAssets(sessionId: string, assets: Record<string, string>) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { assets });
}

/** 텍스트 모션 활성화 여부 저장 */
export async function updateDesignMotionEnabled(sessionId: string, enabled: boolean) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { motionEnabled: enabled });
}

/** 섹션 재생성 횟수 증가 */
export async function incrementSectionRegen(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { sectionRegenCount: (snap.data().sectionRegenCount ?? 0) + 1 });
}

/** 폰트 선택 저장 */
export async function updateFontChoice(sessionId: string, fontChoice: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { fontChoice });
}

/** shareId 발급 및 저장 (없을 때만 신규 발급) */
export async function ensureShareId(sessionId: string): Promise<string> {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("세션 없음");
  const existing = snap.data().shareId as string | undefined;
  if (existing) return existing;
  const { nanoid } = await import("nanoid");
  const newId = nanoid(8);
  await updateDoc(ref, { shareId: newId });
  return newId;
}

/** shareId로 공개 세션 조회 (로그인 불필요) */
export async function getSessionByShareId(shareId: string) {
  const q = query(collection(db, "sessions"), where("shareId", "==", shareId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
}

/** 공유 링크 ID 저장 */
export async function saveShareId(sessionId: string, shareId: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { shareId });
}

/** HTML 디자인 생성 결과 저장 (+ 재생성 횟수 증가) */
export async function saveHtmlDesign(
  sessionId: string,
  htmlDesign: import("./types").HtmlDesignResult,
  designGenCount: number
) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    htmlDesign,
    designGenCount: designGenCount + 1,
  });
}

/** HTML 섹션 수정 결과 저장 (fullHtml 교체, 수정 횟수 증가) */
export async function saveHtmlDesignEdit(
  sessionId: string,
  fullHtml: string,
  designEditCount: number
) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    "htmlDesign.fullHtml": fullHtml,
    designEditCount: designEditCount + 1,
  });
}

/** AI 디자인 생성 결과 저장 (+ 재생성 횟수 증가) */
export async function saveDesignResult(
  sessionId: string,
  designResult: import("./types").DesignResult,
  designGenCount: number
) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, {
    designResult,
    designGenCount: designGenCount + 1,
  });
}

/** 무료 체험 결제 피드백 저장 */
export async function saveFeedback(sessionId: string, star: number, text: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { feedbackStar: star, feedbackText: text });
}

/** 후기 Firestore reviews 컬렉션에 저장 */
export async function saveReview(
  uid: string,
  star: number,
  text: string,
  type: import("./types").ReviewType,
  sessionId?: string
) {
  await addDoc(collection(db, "reviews"), {
    uid,
    star,
    text,
    type,
    sessionId: sessionId ?? null,
    createdAt: serverTimestamp(),
  });
}

/** 무료 체험 소진 처리 */
export async function markFreeTrialUsed(userId: string) {
  await updateDoc(doc(db, "users", userId), { freeTrialUsed: true });
}

/** 콘티/디자인 후기를 남겼음을 기록 (이후 해당 타입 후기 팝업을 다시 띄우지 않기 위함) */
export async function markReviewDone(userId: string, type: import("./types").ReviewType) {
  const field = type === "conti" ? "contiReviewDone" : "designReviewDone";
  await updateDoc(doc(db, "users", userId), { [field]: true });
}

/** 생성 결과 저장 */
export async function saveGeneration(
  userId: string,
  sessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any,
  content: string
) {
  await addDoc(collection(db, "generations"), {
    userId,
    sessionId,
    formData,
    content,
    createdAt: serverTimestamp(),
  });
}
