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

// 빈 줄(문단 구분)을 기준으로 블록을 나누다 보면 **bold** 마커가 짝을 잃고
// 다른 블록으로 분리되는 경우가 있다. 짝이 맞지 않는 ** 는 화면에 그대로
// 노출되므로, 한 줄 안에서 ** 개수가 홀수면(=짝이 없음) 모두 제거한다.
function stripUnpairedBold(line: string): string {
  const count = (line.match(/\*\*/g) ?? []).length;
  return count % 2 === 0 ? line : line.replace(/\*\*/g, "");
}

export function parseContiBlocks(contiText: string): DesignSection[] {
  // 디자인은 "도입부" 섹션부터 시작한다 — 그 앞의 프로젝트 제목/핵심 카피 등은 제외
  const allLines = contiText.split("\n");
  const introIdx = allLines.findIndex((l) => /^#{1,6}.*도입부/.test(l.trim()));
  const lines = introIdx >= 0 ? allLines.slice(introIdx) : allLines;

  const blocks: Omit<DesignSection, "layout" | "textHierarchy" | "motionTemplate">[] = [];
  let currentLines: string[] = [];
  let blockId = 0;
  let slotCounter = 0;

  function flush() {
    if (!currentLines.length) return;
    const hasImage = currentLines.some((l) => PLACEHOLDER_RE.test(l));
    // **bold** 마크다운은 제거하지 않고 남겨둔다 — 디자인 렌더러가 굵게
    // 표시하기 위한 마커로 사용한다 (components/design-renderer/layouts.tsx)
    const textLines = currentLines
      .filter((l) => !PLACEHOLDER_RE.test(l))
      .map((l) => l.replace(/\(([^)]+)\)/g, "").trim())
      .filter((l) => l.length > 0)
      .map(stripUnpairedBold);

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

// ─── 블록 카피 수정 → 콘티 텍스트 반영 ─────────────────────────────────────
// 디자인 섹션의 textLines가 수정됐을 때, contiText 안에서 같은 블록(blockId)의
// 본문 라인만 새 내용으로 교체한다. 이미지 슬롯 표시 라인 "(placeholder_N)"은
// parseContiBlocks가 textLines에서 제외하므로, 교체 시에도 그대로 보존한다.
export function replaceBlockTextInConti(
  contiText: string,
  blockId: string,
  newTextLines: string[]
): string {
  const allLines = contiText.split("\n");
  const introIdx = allLines.findIndex((l) => /^#{1,6}.*도입부/.test(l.trim()));
  const baseOffset = introIdx >= 0 ? introIdx : 0;
  const lines = allLines.slice(baseOffset);

  let blockCounter = 0;
  let currentStart = -1;
  let currentLines: string[] = [];
  const result: { replacement: { start: number; end: number; lines: string[] } | null } = { replacement: null };

  function flush(endExclusive: number) {
    if (!currentLines.length) return;
    const hasImage = currentLines.some((l) => PLACEHOLDER_RE.test(l));
    const textLines = currentLines
      .filter((l) => !PLACEHOLDER_RE.test(l))
      .map((l) => l.replace(/\(([^)]+)\)/g, "").trim())
      .filter((l) => l.length > 0);

    if (textLines.length > 0 || hasImage) {
      const id = `s${blockCounter++}`;
      if (id === blockId) {
        const placeholderLines = currentLines.filter((l) => PLACEHOLDER_RE.test(l));
        result.replacement = { start: currentStart, end: endExclusive, lines: [...placeholderLines, ...newTextLines] };
      }
    }
    currentLines = [];
    currentStart = -1;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_PATTERNS.some((p) => p.test(line.trim()))) {
      flush(i);
      continue;
    }
    if (line.trim() === "") {
      flush(i);
    } else {
      if (currentStart === -1) currentStart = i;
      currentLines.push(line);
    }
  }
  flush(lines.length);

  const rep = result.replacement;
  if (!rep) return contiText;
  const newLines = [...lines.slice(0, rep.start), ...rep.lines, ...lines.slice(rep.end)];
  return [...allLines.slice(0, baseOffset), ...newLines].join("\n");
}
