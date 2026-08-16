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
  introStyle: "empathy" | "usp" | "auto" | ""; // 도입부 전략
  marketSituation: string;   // 시장 상황/트렌드
  priceInfo: string;         // 가격 정보 (시장 대비 가격 경쟁력 포함)
  toneAndManner: string;     // 톤앤매너
  requestProductName?: boolean; // AI 제품명 추천 요청 여부
}

// Firebase Firestore 유저 문서
export interface UserDoc {
  email: string;
  freeTrialUsed: boolean;
  createdAt: number;
  contiReviewDone?: boolean;   // 콘티 작성 후기를 이미 남겼는지 (다시 노출 안 함)
  designReviewDone?: boolean;  // 디자인 완성 후기를 이미 남겼는지 (다시 노출 안 함)
}

// 후기 유도 팝업 구분
export type ReviewType = "conti" | "design";

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

export type TextHierarchy = "headline" | "subhead" | "body" | "caption";

export interface DesignSection {
  id: string;
  textLines: string[];            // 콘티 카피 라인 (괄호 제거 후)
  imageSlotIndex: number | null;  // 이미지 슬롯 인덱스 (placeholder_N), null = 이미지 없음
  layout: LayoutType;
  textHierarchy: TextHierarchy;
  lineHierarchies?: TextHierarchy[]; // 줄별 hierarchy (textHierarchy 오버라이드)
  textColorOverride?: string;        // 섹션별 텍스트 색상 오버라이드 (#rrggbb 등)
  imageAspectRatio?: string;         // 이미지 표시 비율 ("3/4"|"4/5"|"1/1"|"4/3"|"16/9"|"original")
  motionTemplate: MotionTemplateType;
  splitDirection?: "text-left" | "text-right";
  cardCount?: 2 | 3;
}

export interface DesignResult {
  sections: DesignSection[];
  generatedAt: number;
}

export interface HtmlDesignResult {
  fullHtml: string;      // Claude가 생성한 전체 HTML 문서
  sectionIds: string[];  // section-0, section-1, ... 순서 배열
  generatedAt: number;
}

// Firebase Firestore 후기 문서
export interface ReviewDoc {
  uid: string;
  star: number;       // 1~5
  text: string;
  createdAt: number;
}

// CS 문의 카테고리
export type InquiryCategory = "콘티" | "디자인" | "결제" | "기타";

// CS 문의 상태
export type InquiryStatus = "대기" | "답변완료";

// Firebase Firestore CS 문의 문서
export interface InquiryDoc {
  uid: string;
  email: string;            // 작성자 이메일 (관리자 화면 표시용)
  sessionId?: string;       // 관련 세션 (선택)
  productName?: string;     // 관련 세션의 제품명 (선택, 표시용)
  category: InquiryCategory;
  message: string;
  status: InquiryStatus;
  reply?: string;
  repliedAt?: number;
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
  designEditCount: number;     // 디자인 섹션 부분 수정 횟수 (최대 30회)

  // 상품 B 콘티 결과 텍스트
  contiText?: string;          // AI 생성 콘티 전문 (이미지 슬롯 파싱용)
  contiDraft?: string;         // 생성 도중 오류 발생 시 그때까지 만들어진 부분 결과 (복구용)

  // 자동 임시저장 (스텝 전환 시 — 브라우저 저장소 유실 대비)
  formDraft?: FormData;        // 작성 중인 폼 입력 스냅샷
  formStep?: number;           // 임시저장 시점의 작성 단계

  // 상품 B 디자인 설정
  selectedTone?: string;       // 선택된 디자인 톤 ID
  fontChoice?: string;         // 선택된 폰트명 ("recommended" = 톤 추천 폰트)
  colorChoice?: string;        // 선택된 포인트 컬러 프리셋 ID ("recommended" = 톤 추천 색상)
  alignChoice?: string;        // 텍스트 정렬 ("recommended" | "left" | "center", recommended = left)
  shareId?: string;            // 공유 링크용 고유 ID
  assets?: {                   // 업로드 이미지 에셋 매핑 { placeholderId: imageUrl }
    [placeholderId: string]: string;
  };
  designResult?: DesignResult; // AI 디자인 생성 결과 (구 방식 — 템플릿 기반)
  htmlDesign?: HtmlDesignResult; // AI 디자인 생성 결과 (신 방식 — HTML/CSS)
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
  colorChoice?: string;
  alignChoice?: string;
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
