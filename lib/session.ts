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

  // 만료 확인
  const expiresAt = (data.expiresAt as Timestamp).toMillis();
  if (Date.now() > expiresAt) {
    await updateDoc(doc(db, "sessions", docSnap.id), { status: "expired" });
    return null;
  }

  return {
    id: docSnap.id,
    productName: data.productName as string,
    productHash: data.productHash as string,
    expiresAt: data.expiresAt as Timestamp,
    status: data.status as string,
    generationCount: data.generationCount as number,
    userId: data.userId as string,
  };
}

/** 새 세션 생성 */
export async function createSession(userId: string, productName: string) {
  const now = Date.now();
  const ref = await addDoc(collection(db, "sessions"), {
    userId,
    productName,
    productHash: hashProduct(productName),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + SEVENTY_TWO_HOURS),
    status: "active",
    generationCount: 0,
  });
  return ref.id;
}

/** 세션 수정 횟수 증가 */
export async function incrementGeneration(sessionId: string) {
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { generationCount: (snap.data().generationCount ?? 0) + 1 });
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
