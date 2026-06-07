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

// AI 디자인 생성 결과 — 섹션 단위
export type LayoutType =
  | "full-wide"
  | "split"
  | "stack"
  | "text-only"
  | "card-grid"
  | "image-full";

export type MotionTemplateType =
  | "underline-draw"
  | "marker-highlight"
  | "soft-scale"
  | "gradient-fill"
  | "box-blink"
  | null;

export type TextHierarchy = "headline" | "subhead" | "body";

export interface DesignSection {
  id: string;
  textLines: string[];            // 콘티 카피 라인 (괄호 제거 후)
  imageSlotIndex: number | null;  // 이미지 슬롯 인덱스 (placeholder_N), null = 이미지 없음
  layout: LayoutType;
  textHierarchy: TextHierarchy;
  motionTemplate: MotionTemplateType;
  splitDirection?: "text-left" | "text-right";
  cardCount?: 2 | 3;
}

export interface DesignResult {
  sections: DesignSection[];
  generatedAt: number;
}

// Firebase Firestore 후기 문서
export interface ReviewDoc {
  uid: string;
  star: number;       // 1~5
  text: string;
  createdAt: number;
}

// Firebase Firestore 세션 문서
export interface SessionDoc {
  userId: string;
  productName: string;
  productHash: string;       // 제품명 해시 (제품 잠금용)
  createdAt: number;
  expiresAt?: number;        // (시간 제한 없음으로 변경됨, 하위 호환성을 위해 옵셔널)
  status: "active" | "expired";
  generationCount: number;   // 기존 수정 횟수 (하위 호환용)

  // 상품 A & B 세부 카운터 (시간 제한 없음)
  contiGenCount: number;       // 콘티 재생성 횟수 (최대 10회)
  contiEditCount: number;      // 콘티 수정 횟수 (최대 30회)
  designGenCount: number;      // 디자인 전체 재생성 횟수 (최대 5회)
  sectionRegenCount: number;   // 디자인 섹션 재생성 횟수 (최대 30회)
  designEditCount: number;     // 하위 호환용 (단순 편집 — 횟수 제한 없음)

  // 상품 B 콘티 결과 텍스트
  contiText?: string;          // AI 생성 콘티 전문 (이미지 슬롯 파싱용)

  // 상품 B 디자인 설정
  selectedTone?: string;       // 선택된 디자인 톤 ID
  fontChoice?: string;         // 선택된 폰트명 ("recommended" = 톤 추천 폰트)
  shareId?: string;            // 공유 링크용 고유 ID
  assets?: {                   // 업로드 이미지 에셋 매핑 { placeholderId: imageUrl }
    [placeholderId: string]: string;
  };
  designResult?: DesignResult; // AI 디자인 생성 결과
  motionEnabled?: boolean;     // 텍스트 모션 활성화 여부
  feedbackStar?: number;       // 무료 체험 후기 별점 (1~5)
  feedbackText?: string;       // 한줄 후기
}

// 클라이언트 세션 상태
export interface SessionState {
  sessionId: string | null;
  productName: string | null;
  status: "none" | "active" | "expired";

  // 세부 횟수 상태
  contiGenCount: number;
  contiEditCount: number;
  designGenCount: number;
  sectionRegenCount: number;
  designEditCount: number;

  // 디자인 설정
  selectedTone?: string;
  fontChoice?: string;
  shareId?: string;
  assets?: {
    [placeholderId: string]: string;
  };
  designResult?: DesignResult;
  motionEnabled?: boolean;
}

// 생성된 콘티
export interface GenerationDoc {
  userId: string;
  sessionId: string;
  formData: FormData;
  content: string;
  createdAt: number;
}

// 결제 상태 (목업)
export type PaymentStatus = "idle" | "pending" | "success" | "failed";
