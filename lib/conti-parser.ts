import { DesignSection, LayoutType, MotionTemplateType, TextHierarchy } from "./types";

// ─── 콘티 텍스트 → 블록 파싱 ───────────────────────────────────────────────
// 클라이언트(업로드 페이지)와 서버(AI 디자인 생성)가 동일한 슬롯 인덱스를
// 공유해야 하므로, AI SDK 의존성이 없는 순수 파싱 로직만 이 파일에 둔다.
// (design-ai.ts는 Anthropic SDK를 top-level에서 초기화하므로 클라이언트
// 컴포넌트에서 import하면 "browser-like environment" 런타임 에러가 발생한다.)

const SKIP_PATTERNS = [
  /^#{1,6}\s/,
  /^---+$/,
  /^>\s*/,
  /입력되지 않은 정보/,
  /임의로 작성되었으니/,
  /확인해 주세요/,
  /^\*\*프로젝트 제목\*\*/,
  /^\*\*핵심 카피\*\*/,
];

export const PLACEHOLDER_RE = /^\s*\(([^)]+)\)\s*$/;

export function parseContiBlocks(contiText: string): DesignSection[] {
  const lines = contiText.split("\n");
  const blocks: Omit<DesignSection, "layout" | "textHierarchy" | "motionTemplate">[] = [];
  let currentLines: string[] = [];
  let blockId = 0;
  let slotCounter = 0;

  function flush() {
    if (!currentLines.length) return;
    const hasImage = currentLines.some((l) => PLACEHOLDER_RE.test(l));
    const textLines = currentLines
      .filter((l) => !PLACEHOLDER_RE.test(l))
      .map((l) => l.replace(/\(([^)]+)\)/g, "").trim())
      .filter((l) => l.length > 0);

    if (textLines.length > 0 || hasImage) {
      blocks.push({
        id: `s${blockId++}`,
        textLines,
        imageSlotIndex: hasImage ? slotCounter++ : null,
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    if (SKIP_PATTERNS.some((p) => p.test(line.trim()))) {
      flush();
      continue;
    }
    if (line.trim() === "") {
      flush();
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return blocks
    .filter((b) => b.textLines.length > 0 || b.imageSlotIndex !== null)
    .map((b) => ({
      ...b,
      layout: "text-only" as LayoutType,
      textHierarchy: "body" as TextHierarchy,
      motionTemplate: null as MotionTemplateType,
    }));
}
