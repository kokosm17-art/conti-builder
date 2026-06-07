# 상품 B (콘티+디자인 자동화) 세부 디자인 및 개발 스펙 명세서

본 문서는 개발 구현 시 코더(AI 또는 개발자)가 즉시 복사하여 반영할 수 있도록 스타일 코드 및 데이터 파싱의 구체적인 규격을 명시합니다.

---

## 1. 디자인 톤 5종 세부 CSS 규격 (스타일 가이드)

각 디자인 톤은 Tailwind CSS 스타일 토큰으로 정의되어 최종 미리보기 렌더러에 매칭됩니다.

| 디자인 톤 | 배경색 (Background) | 기본 글자색 (Text) | 포인트 색상 (Accent) | 추천 폰트 | 여백 및 무드 (Mood) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 감성 톤** | `bg-[#FAF8F5]` (웜 크림) | `text-[#1A1A1A]` (차콜) | `text-[#8C6239]` (소프트 브라운) | 프리텐다드 | 여백이 부드럽고 차분한 스토리북 느낌 |
| **2. 씨네마틱 톤** | `bg-[#0A0A0A]` (딥 블랙) | `text-[#FFFFFF]` (화이트) | 블루-퍼플 그라디언트 | Noto Sans CJK KR | 스포트라이트 오버레이 및 힙한 테크 감성 |
| **3. 임팩트 톤** | `bg-[#FFFFFF]` (순백) | `text-[#111111]` (블랙) | `bg-[#FF4500]`, `text-white` | Gmarket Sans | 형광 톤 컬러 태그, 굵고 볼드한 문장 중심 |
| **4. 프리미엄 톤** | `bg-[#E8E0D8]` (그레이지) | `text-[#1E1E1E]` (소프트 블랙)| `text-[#2B4F8C]` (뮤트 네이비) | 바른바탕체 | 극도의 고급스러운 여백, 클래식한 세리프 |
| **5. 미니멀 톤** | `bg-[#FFFFFF]` (순백) | `text-[#444444]` (미디엄 그레이) | `text-[#222222]` (다크 그레이) | 노토산스 KR | 제품이 인테리어 오브제처럼 돋보이는 얇은 폰트 |

**전체 선택 가능 폰트 6종** (고객이 직접 선택 시 톤 추천과 무관하게 적용):
프리텐다드 / Noto Sans CJK KR / Gmarket Sans / 노토산스 KR / 나눔체 / 배달의민족 주아체

---

## 2. 텍스트 애니메이션 5종 CSS 구현 방식

애니메이션은 글자가 깜빡거리거나 갑자기 사라졌다가 나타나는(Fade-in/out, Typing) 산만한 효과를 제외하고, 화면에 처음부터 글자가 나타난 상태에서 동작하는 고급스러운 인터랙션으로 구현합니다.

### 1) 밑줄 드로잉 (Underline Draw)
- **원리**: 텍스트 아래에 포인트 컬러 밑줄이 왼쪽에서 오른쪽으로 스르륵 채워지는 애니메이션.
- **CSS**:
  ```css
  .animate-underline-draw {
    position: relative;
    display: inline-block;
  }
  .animate-underline-draw::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 100%;
    height: 3px;
    background-color: var(--accent-color);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.8s ease-out;
  }
  .animate-underline-draw.active::after {
    transform: scaleX(1);
  }
  ```

### 2) 형광펜 하이라이트 (Marker Highlight)
- **원리**: 텍스트 뒤 배경에 형광펜 칠을 하듯 포인트 색상 배경이 왼쪽에서 오른쪽으로 채워지는 효과.
- **CSS**:
  ```css
  .animate-marker-highlight {
    background: linear-gradient(to right, var(--highlight-color) 50%, transparent 50%);
    background-size: 200% 100%;
    background-position: right bottom;
    transition: background-position 0.8s ease-out;
  }
  .animate-marker-highlight.active {
    background-position: left bottom;
  }
  ```

### 3) 굵기 피드백 (Soft Scale Up)
- **원리**: 텍스트 영역이 미세하게 1.03~1.05배 확대되며 굵어져서 자연스럽게 시선이 가도록 유도.
- **CSS**:
  ```css
  .animate-soft-scale {
    display: inline-block;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), font-weight 0.5s ease;
  }
  .animate-soft-scale.active {
    transform: scale(1.04);
    font-weight: 700;
  }
  ```

### 4) 컬러 그라디언트 물들기 (Gradient Fill)
- **원리**: 처음에는 단색 텍스트였다가 톤에 어울리는 그라디언트 텍스트 컬러로 자연스럽게 전환되는 효과.
- **CSS**:
  ```css
  .animate-gradient-fill {
    background: linear-gradient(to right, var(--text-color) 50%, var(--gradient-color-start) 50%, var(--gradient-color-end) 100%);
    background-size: 200% 100%;
    background-position: right bottom;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transition: background-position 0.8s ease-out;
  }
  .animate-gradient-fill.active {
    background-position: left bottom;
  }
  ```

### 5) 박스 배경 깜빡이 (Box Blink)
- **원리**: 핵심 단어 주변에 연하게 채워진 둥근 사각형 배경 박스가 생성되며, 불투명도(Opacity)가 2~3회 깜빡거린 후 은은하게 시선을 붙잡는 효과.
- **CSS**:
  ```css
  @keyframes soft-blink {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.25; }
  }
  .animate-box-blink {
    position: relative;
    z-index: 1;
  }
  .animate-box-blink::before {
    content: '';
    position: absolute;
    inset: -2px -6px;
    background-color: var(--accent-color);
    border-radius: 4px;
    z-index: -1;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .animate-box-blink.active::before {
    opacity: 0.15;
    animation: soft-blink 1s ease-in-out 2;
  }
  ```

---

## 3. 콘티 텍스트 ➔ 디자인 파싱 정규식 규칙

시스템은 텍스트 내부의 괄호 영역을 찾아 사진 업로드 영역으로 변환해야 합니다.

- **파싱 규칙 (Regex)**: `/\(([^)]+)\)/g`
  - 괄호 `(...)` 안에 들어 있는 텍스트를 이미지 자리표시자의 **추천 가이드 텍스트**로 인식합니다.
  - 예: `(메이커 제공 이미지)` ➔ `추천 가이드: 메이커 제공 이미지` 문구를 포함한 드롭존 박스로 교체.
  - 사용자가 업로드 단계를 진행할 때, 각각의 괄호 텍스트마다 1개의 파일 입력(FileInput) 슬롯이 고유한 `placeholderId`(예: `placeholder_0`, `placeholder_1`)와 매핑됩니다.

---

## 4. 결제 게이트 및 무료 체험 후기 동선

### 4.1 신규 고객 무료 체험 전체 플로우

```
신규 고객 가입
  └─ 콘티 무료 생성
       └─ 디자인 무료 생성
            └─ [다운로드] 버튼 클릭
                 └─ 후기 작성 유도 모달 노출
                      ├─ [후기 남기기] → 별점 + 한 줄 후기 저장 → 다운로드 진행
                      └─ [다음에 할게요] → 건너뛰기 → 다운로드 진행
```

### 4.2 후기 유도 모달 (다운로드 버튼 클릭 시)

1. **노출 조건**: `freeTrialUsed === false`인 사용자가 다운로드 버튼을 클릭한 시점.
2. **모달 내용**:
   - 타이틀: "사용해 보셨나요? 솔직한 후기를 들려주세요"
   - 별점 선택 (1~5점)
   - 한 줄 후기 입력창 (선택 사항)
   - 버튼: `[후기 남기고 다운로드]` / `[건너뛰고 다운로드]`
3. **데이터 저장**:
   - Firestore `reviews` 컬렉션에 `{ uid, star, text, createdAt }` 형태로 저장.
   - **서비스 화면에 공개되지 않으며**, 대표자 전용 내부 페이지(`/admin/reviews`)에서만 확인 가능.
   - 후기 작성 여부와 무관하게 `freeTrialUsed: true`로 업데이트 후 다운로드 진행.

### 4.3 결제 게이트 (2번째 이용부터)

1. **홈 화면 버튼 노출 기준** (`freeTrialUsed` 값에 따라 버튼 텍스트가 달라짐):
   - `false` (신규 고객) → `[무료 체험하기]` 버튼 노출 → 클릭 시 무료 체험 플로우로 진입 (4.1 참고)
   - `true` (기존 고객) → `[지금 콘티 만들기]` / `[지금 콘티+디자인 만들기]` 버튼 노출 → 클릭 시 결제 게이트 모달 즉시 노출
2. **결제 게이트 모달**:
   - 타이틀: "콘티+디자인을 계속 만들려면 결제가 필요해요"
   - 본문: "무료 체험이 완료되었습니다. 이후 이용은 콘티 생성 **50,000원** / 콘티+디자인 생성 **100,000원** 결제 후 사용 가능합니다."
   - 버튼: `[결제하기]` / `[닫기]`
   - 결제 완료 전까지 콘티 및 디자인 생성 불가.

---

## 5. AI 레이아웃 템플릿 6종 구현 규격 (확정 2026-06-03)

AI가 콘티 카피를 분석한 뒤 섹션별로 아래 6종 중 하나를 자동 선택합니다. 각 레이아웃은 디자인 톤의 CSS 변수를 그대로 물려받습니다.

### 5.1 풀와이드 (Full Wide)
- **구조**: 이미지가 컨테이너 전체 폭(`w-full`)을 채우고, 텍스트는 이미지 위 오버레이(`absolute`)로 배치
- **텍스트 위치**: 하단 좌측 정렬 기본 (`bottom-8 left-8`)
- **이미지 높이**: `min-h-[480px]`, 객체 맞춤 `object-cover`
- **사용 조건**: 이미지 자리표시자 1개 + 헤드라인 카피

### 5.2 좌우 분할 (Split)
- **구조**: `flex` 행 방향, 텍스트 영역 `w-1/2` + 이미지 영역 `w-1/2`
- **방향**: AI가 카피 흐름에 따라 텍스트-좌/이미지-우 또는 반대 결정
- **이미지 높이**: 텍스트 영역 높이에 맞춰 자동 (`h-full object-cover`)
- **사용 조건**: 이미지 자리표시자 1개 + 본문 카피 (기능 설명)

### 5.3 상하 분할 (Stack)
- **구조**: `flex` 열 방향, 텍스트 블록 + 이미지 블록 순서
- **방향**: 기본 텍스트 상단 → 이미지 하단. AI 판단에 따라 순서 역전 가능
- **이미지 높이**: `h-[360px]` 기본, `object-cover`
- **사용 조건**: 이미지 자리표시자 1개 + 감성 카피

### 5.4 텍스트 전용 (Text Only)
- **구조**: 이미지 없음. 카피와 키워드만으로 구성된 풀와이드 텍스트 블록
- **배경**: 디자인 톤의 배경색 그대로 사용
- **텍스트 정렬**: 중앙 정렬 기본 (`text-center`)
- **사용 조건**: 이미지 자리표시자 0개 (핵심 수치·선언 카피)

### 5.5 카드형 (Card Grid)
- **구조**: `grid grid-cols-2` 또는 `grid-cols-3`, 각 카드에 아이콘/이미지 + 짧은 설명 텍스트
- **카드 수**: AI가 자리표시자 수 및 카피 항목 수에 따라 2열 또는 3열 결정
- **카드 스타일**: 둥근 모서리 (`rounded-xl`), 톤의 포인트 컬러 보더 또는 배경 적용
- **사용 조건**: 이미지 자리표시자 2~3개 + 병렬 나열 카피 (특장점·문제 제시)

### 5.6 이미지 전용 (Image Full)
- **구조**: 이미지가 섹션 전체를 차지. 텍스트는 최소(브랜드명 또는 짧은 태그라인만)
- **이미지 높이**: `min-h-[560px]`, `object-cover`
- **텍스트**: 있는 경우 이미지 하단 또는 상단에 `text-sm` 수준으로 최소 표기
- **사용 조건**: 이미지 자리표시자 1개 + 카피 없거나 1줄 이하 (라이프스타일 비주얼 강조)
