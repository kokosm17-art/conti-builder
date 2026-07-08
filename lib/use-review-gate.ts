"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { saveReview, markReviewDone } from "./session";
import { wasReviewSkippedRecently, markReviewSkipped } from "./review-prompt";
import { ReviewType } from "./types";

/**
 * 콘티/디자인 완성 화면에서 벗어날 때 후기 작성을 유도하는 팝업 상태를 관리한다.
 * - 이미 해당 타입 후기를 남긴 유저(`{type}ReviewDone`)에게는 다시 띄우지 않음
 * - "건너뛰기"를 누른 경우 1일간(SKIP_COOLDOWN_MS)만 다시 노출하지 않음
 */
export function useReviewGate(uid: string | undefined, type: ReviewType) {
  const [eligible, setEligible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const pendingNavigateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid) return;
    if (wasReviewSkippedRecently(type)) return;
    (async () => {
      const snap = await getDoc(doc(db, "users", uid));
      const done = snap.exists() && snap.data()[`${type}ReviewDone`] === true;
      if (!done) setEligible(true);
    })();
  }, [uid, type]);

  /** 나가는 동작을 감싸서, 필요하면 먼저 후기 팝업을 띄운다 */
  const guardedNavigate = useCallback(
    (navigate: () => void) => {
      if (eligible) {
        pendingNavigateRef.current = navigate;
        setShowModal(true);
      } else {
        navigate();
      }
    },
    [eligible]
  );

  async function handleSubmit(star: number, text: string, sessionId?: string) {
    setShowModal(false);
    setEligible(false);
    if (uid) {
      await saveReview(uid, star, text, type, sessionId).catch(() => {});
      await markReviewDone(uid, type).catch(() => {});
    }
    pendingNavigateRef.current?.();
  }

  function handleSkip() {
    setShowModal(false);
    setEligible(false);
    markReviewSkipped(type);
    pendingNavigateRef.current?.();
  }

  return { showModal, guardedNavigate, handleSubmit, handleSkip };
}
