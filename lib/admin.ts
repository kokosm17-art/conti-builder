// 관리자 계정 식별자 (UID 기반 — 이메일은 클라이언트 코드에 노출하지 않음)
export const ADMIN_UID = "stWLKKMBhbTsYwrHUtE549xg16k1";

export function isAdmin(uid: string | null | undefined): boolean {
  return !!uid && uid === ADMIN_UID;
}

// 결제 없이 무제한 사용 가능한 어드민 이메일 목록
const ADMIN_EMAILS = ["kokosm17@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
