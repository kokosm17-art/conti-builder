import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { InquiryCategory, InquiryStatus } from "./types";

export interface InquiryItem {
  id: string;
  uid: string;
  email: string;
  sessionId?: string;
  productName?: string;
  category: InquiryCategory;
  message: string;
  status: InquiryStatus;
  reply?: string;
  repliedAt?: Timestamp;
  createdAt?: Timestamp;
}

/** CS 문의 등록 */
export async function createInquiry(params: {
  uid: string;
  email: string;
  sessionId?: string;
  productName?: string;
  category: InquiryCategory;
  message: string;
}) {
  await addDoc(collection(db, "inquiries"), {
    ...params,
    status: "대기",
    createdAt: serverTimestamp(),
  });
}

/** 내 문의 내역 조회 (마이페이지) */
export async function getMyInquiries(uid: string): Promise<InquiryItem[]> {
  const q = query(collection(db, "inquiries"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InquiryItem[];
  items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return items;
}

/** 전체 문의 조회 (관리자) */
export async function getAllInquiries(): Promise<InquiryItem[]> {
  const snap = await getDocs(collection(db, "inquiries"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as InquiryItem[];
  items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return items;
}

/** 문의 답변 등록 (관리자) */
export async function replyToInquiry(inquiryId: string, reply: string) {
  await updateDoc(doc(db, "inquiries", inquiryId), {
    reply,
    status: "답변완료",
    repliedAt: serverTimestamp(),
  });
}
