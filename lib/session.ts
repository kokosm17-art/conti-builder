import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
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
    selectedTone: data.selectedTone as string | undefined,
    fontChoice: data.fontChoice as string | undefined,
    shareId: data.shareId as string | undefined,
    assets: data.assets as Record<string, string> | undefined,
    designResult: data.designResult as import("./types").DesignResult | undefined,
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

/** 콘티 생성 결과 텍스트 저장 (이미지 슬롯 파싱용) */
export async function saveContiText(sessionId: string, contiText: string) {
  const ref = doc(db, "sessions", sessionId);
  await updateDoc(ref, { contiText });
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
export async function saveReview(uid: string, star: number, text: string) {
  await addDoc(collection(db, "reviews"), {
    uid,
    star,
    text,
    createdAt: serverTimestamp(),
  });
}

/** 무료 체험 소진 처리 */
export async function markFreeTrialUsed(userId: string) {
  await updateDoc(doc(db, "users", userId), { freeTrialUsed: true });
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
