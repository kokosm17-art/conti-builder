// html-design-ai.ts(서버 전용, Anthropic SDK 의존)와 분리된 순수 유틸리티.
// 클라이언트 컴포넌트(미리보기 페이지의 "정렬 전환" 버튼)에서 안전하게
// import하기 위해 분리했다 — html-design-ai.ts를 그대로 client에서
// import하면 top-level `new Anthropic()` 때문에 런타임 에러가 난다.

// getPredefinedCss가 항상 ":root { --align: left|center; }" 형태로 정렬값을
// 심어두므로, 재생성 없이 이 값 하나만 바꿔치기하면 전체 문서의 정렬이
// 즉시 바뀐다. 값을 못 찾으면(과거 세션 등) 원본을 그대로 반환한다.
export function getAlignFromHtml(fullHtml: string): "left" | "center" {
  const match = fullHtml.match(/--align:\s*(left|center)\s*;/);
  return match?.[1] === "center" ? "center" : "left";
}

// accent-bar/i-divider(포인트 제목 아래 짧은 강조선)는 고정폭 요소라 text-align의
// 영향을 받지 않는다 — margin-left/right를 --align-margin(0|auto)으로 따로 제어해야
// 가운데 정렬 시 함께 옮겨간다.
const DIVIDER_MARGIN_RULE = `\n.accent-bar, .i-divider { margin-left: var(--align-margin); margin-right: var(--align-margin); }\n`;

export function toggleAlignInHtml(fullHtml: string): string {
  const hasAlignVar = /--align:\s*(left|center)\s*;/.test(fullHtml);

  // 이 기능이 생기기 전에 만들어진 예전 디자인 — --align 변수 자체가 없다.
  // 지금 화면은 기본값인 좌측 정렬 상태이므로, 이번 클릭으로 정렬 값을
  // 새로 만들면서 바로 중앙 정렬로 전환한다. </style> 바로 앞에 추가하면
  // CSS 우선순위(나중에 나온 규칙이 이긴다)에 따라 자연스럽게 적용되고,
  // .s-cta처럼 항상 중앙이어야 하는 클래스 선택자는 특이도가 더 높아서
  // 이 section 규칙에 영향받지 않고 그대로 유지된다.
  if (!hasAlignVar) {
    if (!fullHtml.includes("</style>")) return fullHtml; // <style> 자체가 없는 손상된 문서 등 극단적 예외
    const injected = `\n:root{--align:center;--align-margin:auto;}\nsection{text-align:var(--align);}\n${DIVIDER_MARGIN_RULE}`;
    return fullHtml.replace("</style>", `${injected}</style>`);
  }

  const current = getAlignFromHtml(fullHtml);
  const next = current === "left" ? "center" : "left";
  const nextMargin = next === "center" ? "auto" : "0";

  let html = fullHtml.replace(/--align:\s*(left|center)\s*;/, `--align: ${next};`);

  const hasAlignMarginVar = /--align-margin:\s*(auto|0)\s*;/.test(html);
  if (hasAlignMarginVar) {
    html = html.replace(/--align-margin:\s*(auto|0)\s*;/, `--align-margin: ${nextMargin};`);
  } else if (html.includes("</style>")) {
    // --align은 있지만 --align-margin이 없던 중간 버전 — 강조선 정렬 규칙이 생기기 전.
    html = html.replace("</style>", `\n:root{--align-margin:${nextMargin};}\n</style>`);
  }

  const hasDividerRule = html.includes(".accent-bar, .i-divider {");
  if (!hasDividerRule && html.includes("</style>")) {
    html = html.replace("</style>", `${DIVIDER_MARGIN_RULE}</style>`);
  }

  return html;
}
