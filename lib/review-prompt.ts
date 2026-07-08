import { ReviewType } from "./types";

const SKIP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 후기를 건너뛴 경우 1일간 다시 노출하지 않음

function skipKey(type: ReviewType) {
  return `review_skip_${type}`;
}

/** 최근 쿨다운 기간 내에 해당 타입의 후기 팝업을 건너뛰었는지 */
export function wasReviewSkippedRecently(type: ReviewType): boolean {
  try {
    const ts = localStorage.getItem(skipKey(type));
    if (!ts) return false;
    return Date.now() - Number(ts) < SKIP_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** 후기 팝업 "건너뛰기" 시각 기록 */
export function markReviewSkipped(type: ReviewType) {
  try {
    localStorage.setItem(skipKey(type), String(Date.now()));
  } catch {}
}
