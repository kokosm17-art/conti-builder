// 페이지 타입
export type PageType = "wadiz" | "general";

// 폼 입력 데이터
export interface FormData {
  pageType: PageType;        // 페이지 타입 (와디즈 / 일반 쇼핑몰)
  productName: string;       // 제품명
  mainCustomer: string;      // 메인 고객
  subCustomer: string;       // 서브 고객
  corePainPoint: string;     // 고객 핵심 문제 (불편함)
  customerDesire: string;    // 고객 갈망 (이상적 이미지/일상)
  usp1: string;              // USP 1
  usp2: string;              // USP 2
  usp3: string;              // USP 3
  additionalFeatures: string; // 추가 장점 및 특징
  authority: string;         // 권위 (리뷰/수상/누적판매)
  marketAwareness: "high" | "low" | ""; // 고객 인지도 수준
  marketSituation: string;   // 시장 상황/트렌드
  priceInfo: string;         // 가격 정보 (시장 대비 가격 경쟁력 포함)
  toneAndManner: string;     // 톤앤매너
}

// Firebase Firestore 유저 문서
export interface UserDoc {
  email: string;
  freeTrialUsed: boolean;
  createdAt: number;
}

// Firebase Firestore 세션 문서
export interface SessionDoc {
  userId: string;
  productName: string;
  productHash: string;       // 제품명 해시 (제품 잠금용)
  createdAt: number;
  expiresAt: number;         // createdAt + 72시간
  status: "active" | "expired";
  generationCount: number;   // 수정 횟수
}

// 생성된 콘티
export interface GenerationDoc {
  userId: string;
  sessionId: string;
  formData: FormData;
  content: string;
  createdAt: number;
}

// 클라이언트 세션 상태
export interface SessionState {
  sessionId: string | null;
  productName: string | null;
  expiresAt: number | null;
  generationCount: number;
  status: "none" | "active" | "expired";
}

// 결제 상태 (목업)
export type PaymentStatus = "idle" | "pending" | "success" | "failed";
