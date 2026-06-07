# 상품 B (콘티+디자인 자동화) 개발 작업 명세서

> PRD 기반 작성 / 작성일: 2026-06-03  
> 개발 순서: Phase 1 → 8 순으로 진행. 각 Phase 완료 후 다음 단계 착수.

---

## Phase 1. 기반 작업 — DB 스키마 + 디자인 시스템 등록

### T-01. Firestore 스키마 확장
- `projects` 컬렉션에 디자인 단계 필드 추가
  ```
  projects/{projectId}
    ├─ contieData: { sections: [...] }          // 기존
    ├─ designTone: string                        // 선택한 톤 ID
    ├─ fontChoice: string                        // 선택 폰트명 (없으면 'recommended')
    ├─ designResult: { sections: [...] }         // AI 생성 결과
    ├─ imageSlots: { [placeholderId]: url }      // 업로드된 이미지 URL 맵
    ├─ shareId: string                           // 공유 링크용 고유 ID
    ├─ regenCount: number                        // 전체 재생성 사용 횟수
    ├─ sectionRegenCount: number                 // 섹션 재생성 사용 횟수
    └─ status: 'contie' | 'design' | 'done'
  ```
- `reviews` 컬렉션 신규 생성
  ```
  reviews/{reviewId}
    ├─ uid: string
    ├─ star: number (1~5)
    ├─ text: string
    └─ createdAt: timestamp
  ```
- `users` 컬렉션에 `freeTrialUsed: boolean` 필드 추가

### T-02. 디자인 시스템 5종 컴포넌트 등록
`components/design-system/` 디렉터리 생성 후 톤별 CSS 토큰 파일 작성

| 파일 | 내용 |
|------|------|
| `tone-1-emotional.ts` | 감성 톤 CSS 변수 + Tailwind 클래스 맵 |
| `tone-2-cinematic.ts` | 씨네마틱 톤 |
| `tone-3-impact.ts` | 임팩트 톤 |
| `tone-4-premium.ts` | 프리미엄 톤 |
| `tone-5-minimal.ts` | 미니멀 톤 |
| `index.ts` | toneId → 설정 객체 export |

각 파일에 포함할 항목: `background`, `textColor`, `accentColor`, `recommendedFont`, `mood`

### T-03. 폰트 6종 로드 설정
`app/layout.tsx`에 Google Fonts / 자체 폰트 import 추가

| 폰트명 | 로드 방법 |
|--------|---------|
| 프리텐다드 | `@font-face` (로컬 또는 CDN) |
| Noto Sans CJK KR | Google Fonts |
| Gmarket Sans | CDN |
| 노토산스 KR | Google Fonts |
| 나눔체 | Google Fonts |
| 배달의민족 주아체 | CDN |
| 바른바탕체 | CDN |

### T-04. 모션 템플릿 5종 CSS 구현
`components/motion/` 디렉터리에 CSS 애니메이션 컴포넌트 작성 (design_spec.md 2장 기준)

| 컴포넌트 | 클래스명 |
|---------|---------|
| UnderlineDraw | `animate-underline-draw` |
| MarkerHighlight | `animate-marker-highlight` |
| SoftScaleUp | `animate-soft-scale` |
| GradientFill | `animate-gradient-fill` |
| BoxBlink | `animate-box-blink` |

---

## Phase 2. 홈 화면 수정 + 결제 게이트 모달

### T-05. 홈 화면 버튼 분기 처리
- Firebase Auth 로그인 상태 + `freeTrialUsed` 값에 따라 버튼 텍스트 변경
  - `freeTrialUsed === false` → `[무료 체험하기]`
  - `freeTrialUsed === true` → `[지금 콘티 만들기]` / `[지금 콘티+디자인 만들기]`

### T-06. 결제 게이트 모달 구현
- 기존 고객이 버튼 클릭 시 즉시 노출
- 모달 내용:
  - 타이틀: "콘티+디자인을 계속 만들려면 결제가 필요해요"
  - 본문: 콘티 50,000원 / 디자인 100,000원 안내
  - 버튼: `[결제하기]` (결제 PG 연동 전까지 비활성 또는 임시 안내) / `[닫기]`
- 결제 완료 전까지 생성 플로우 진입 불가 처리

### T-07. 업셀 버튼 추가
- 콘티 완료 화면에 `[디자인도 만들러 가기]` 버튼 노출
- 클릭 시 → 결제 게이트 확인 후 디자인 단계로 이동

---

## Phase 3. 디자인 톤 + 폰트 선택 화면

### T-08. 톤 선택 카드 UI
`app/design/tone/page.tsx` 생성

- 카드 5장 레이아웃 (썸네일 + 톤 이름 + 추천 아이템 + 특징 설명)
- 카드 클릭 시 선택 상태 강조
- 선택된 톤 ID를 상태로 저장

### T-09. 폰트 선택 UI (톤 선택 화면 하단 병행)
- 폰트 목록 6종 + `추천 (톤에 맞는 폰트)` 옵션 포함 라디오 버튼 그룹
- 기본 선택값: `추천`
- 각 폰트 선택지에 해당 폰트로 미리보기 텍스트 렌더링 (예: "와디즈 펀딩 상세페이지")
- `추천` 선택 시 → 선택된 톤의 `recommendedFont` 자동 적용

### T-10. 선택 저장 및 다음 단계 이동
- 톤 + 폰트 선택 완료 후 Firestore `projects/{id}` 업데이트
- `[다음]` 버튼 → 이미지 업로드 단계로 이동

---

## Phase 4. 이미지 업로드 단계

### T-11. 자리표시자 파싱 및 슬롯 UI 생성
- 콘티 데이터에서 `/\(([^)]+)\)/g` 정규식으로 자리표시자 추출 (design_spec.md 3장 기준)
- 각 자리표시자마다 고유 `placeholderId` 부여 (예: `placeholder_0`, `placeholder_1`)
- 슬롯 UI: 회색 점선 박스 + 콘티 지시문 텍스트 표시

### T-12. 슬롯별 이미지 업로드
- 각 슬롯 클릭 시 파일 선택 다이얼로그 오픈
- 지원 포맷: JPG, JPEG, PNG, GIF, WEBP / 용량 제한: 10MB 이하
- 업로드 완료 시 Firebase Storage 저장 → URL을 `imageSlots[placeholderId]`에 저장
- 업로드 된 슬롯: 썸네일 미리보기로 교체

### T-13. 드래그 앤 드롭 이미지 스왑
- 슬롯 간 드래그 앤 드롭으로 이미지 위치 교체
- `@dnd-kit` 또는 HTML5 Drag API 사용

### T-14. 빈 슬롯 허용 처리
- 이미지 미업로드 상태로 `[디자인 생성하기]` 버튼 활성화
- 빈 슬롯은 회색 점선 박스로 디자인에 포함 (미리보기에서 실시간 업로드 가능)

---

## Phase 5. AI 디자인 생성 엔진

### T-15. AI 레이아웃 배치 프롬프트 작성
`lib/design-ai.ts` 생성

AI 입력값:
- 콘티 섹션 배열 (카피 텍스트 + 자리표시자 수)
- 선택된 디자인 톤
- 선택된 폰트

AI 출력값 (JSON):
```typescript
{
  sections: [
    {
      id: string,
      layout: 'full-wide' | 'split' | 'stack' | 'text-only' | 'card-grid' | 'image-full',
      textHierarchy: 'headline' | 'subhead' | 'body',
      motionTemplate: 'underline-draw' | 'marker-highlight' | 'soft-scale' | 'gradient-fill' | 'box-blink' | null,
      splitDirection?: 'text-left' | 'text-right',
      cardCount?: 2 | 3,
    }
  ]
}
```

### T-16. 디자인 조립 렌더러
`components/design-renderer/` 생성

- AI 출력 JSON + 톤 설정 + 폰트 + 이미지 슬롯을 받아 React 컴포넌트로 조립
- 레이아웃 6종 컴포넌트 구현 (design_spec.md 5장 기준):
  - `FullWideSection`
  - `SplitSection`
  - `StackSection`
  - `TextOnlySection`
  - `CardGridSection`
  - `ImageFullSection`
- 각 섹션에 모션 템플릿 클래스 적용

### T-17. 생성 API 라우트
`app/api/design/generate/route.ts` 생성

- POST: 프로젝트 ID 받아 AI 호출 → 결과 Firestore 저장
- 전체 재생성 시 `regenCount` +1, 한도 초과 시 403 반환
- 섹션 재생성 시 `sectionRegenCount` +1, 한도 초과 시 403 반환

---

## Phase 6. 미리보기 화면 + 편집

### T-18. 미리보기 페이지
`app/design/preview/[projectId]/page.tsx` 생성

- 디자인 렌더러로 전체 페이지 조립 및 표시
- 상단 액션바: `[전체 재생성]` `[다운로드]` `[공유 링크 복사]`
- 잔여 재생성 횟수 표시 (예: "전체 재생성 3/5회 남음")

### T-19. 섹션별 재생성 버튼
- 각 섹션 hover 시 `[이 섹션 재생성]` 버튼 노출
- 클릭 시 해당 섹션만 AI 재분석 → 렌더러 부분 업데이트
- `sectionRegenCount` 차감 및 잔여 횟수 표시

### T-20. 텍스트 모션 토글
- 모션 적용된 카피 클릭 시 정적 ↔ GIF 상태 토글
- 토글 상태는 로컬 상태로 관리 (다운로드 시 현재 토글 상태 반영)

### T-21. 미리보기 내 이미지 실시간 업로드
- 빈 슬롯(회색 점선 박스) 클릭 시 파일 선택 → 업로드 → 즉시 렌더러에 반영

---

## Phase 7. 다운로드 + 공유 링크

### T-22. 서버 사이드 렌더링 캡처 API
`app/api/design/render/route.ts` 생성

- Puppeteer로 미리보기 페이지 렌더링
- 섹션별 PNG 캡처 저장
- 모션 적용 섹션은 CSS 애니메이션 재생 후 GIF 캡처 (gif-encoder 또는 puppeteer 기반)

### T-23. ZIP 패키징 및 다운로드
- `archiver` 또는 `jszip` 으로 PNG + GIF 파일 ZIP 압축
- `/api/design/download/[projectId]` 라우트에서 ZIP 스트림 반환
- 클라이언트에서 `[다운로드]` 버튼 클릭 시 자동 다운로드

### T-24. 공유 링크 구현
- 프로젝트 생성 시 `shareId` (nanoid 8자리) 자동 발급 → Firestore 저장
- `app/preview/[shareId]/page.tsx` 생성 — 로그인 없이 누구나 접근 가능
- 미리보기 화면 `[공유 링크 복사]` 버튼 → 클립보드에 URL 복사

---

## Phase 8. 후기 수집 + 어드민 페이지

### T-25. 무료 체험 후기 모달
- 다운로드 버튼 클릭 시 `freeTrialUsed === false` 조건 확인
- 조건 충족 시 모달 노출:
  - 타이틀: "사용해 보셨나요? 솔직한 후기를 들려주세요"
  - 별점 선택 (1~5점)
  - 한 줄 후기 입력창 (선택)
  - 버튼: `[후기 남기고 다운로드]` / `[건너뛰고 다운로드]`
- 제출 또는 건너뛰기 후:
  - Firestore `reviews` 컬렉션에 저장 (후기 남긴 경우)
  - `users/{uid}.freeTrialUsed = true` 업데이트
  - 다운로드 진행

### T-26. 어드민 후기 페이지
`app/admin/reviews/page.tsx` 생성

- 대표자 계정만 접근 가능 (Firebase Custom Claims 또는 UID 하드코딩)
- Firestore `reviews` 컬렉션 목록 표시 (별점, 후기 내용, 작성일)
- 정렬: 최신순 기본

---

## 개발 순서 요약

| 순서 | Phase | 핵심 산출물 |
|------|-------|-----------|
| 1 | Phase 1 | DB 스키마, 디자인 시스템, 폰트, 모션 CSS |
| 2 | Phase 2 | 홈 버튼 분기, 결제 게이트 모달, 업셀 버튼 |
| 3 | Phase 3 | 톤 + 폰트 선택 화면 |
| 4 | Phase 4 | 이미지 업로드 + 드래그앤드롭 |
| 5 | Phase 5 | AI 생성 엔진 + 렌더러 |
| 6 | Phase 6 | 미리보기 + 재생성 + 모션 토글 |
| 7 | Phase 7 | 다운로드 ZIP + 공유 링크 |
| 8 | Phase 8 | 후기 모달 + 어드민 페이지 |

---

## 2차 업데이트 예정 (MVP 이후)

- Vision API 기반 이미지 자동 배치
- 메인 컬러 직접 지정 (색상 피커)
- 참고 이미지 업로드 (분위기 참고용)
- 결제 PG 연동 (토스페이먼츠 / 포트원)
