import Anthropic from "@anthropic-ai/sdk";
import { HtmlDesignResult } from "./types";
import { getToneById, ToneConfig } from "@/components/design-system/tones";

/**
 * LINE BREAKS 규칙 — 이전 버전 백업 (롤백 시 html-design-ai.backup-2026-07-02.ts 참고)
 * → 2026-07-02: 콘티 줄바꿈이 디자인에서 임의로 합쳐지거나 다른 지점에서
 *   재분리되던 문제 대응. buildToneHeader / generateSubsequentPass 프롬프트에
 *   "CONTENT 줄바꿈 그대로 유지, 넘치면 폰트 축소" 규칙 추가.
 *   디자인 퀄리티 저하 시 위 백업 파일 내용으로 되돌릴 것.
 *
 * 톤별 FONT SIZE 가이드 — 이전 버전 백업 (롤백 시 html-design-ai.backup-2026-07-02b.ts 참고)
 * → 2026-07-02: **로 강조 안 된 일반 카피가 지나치게 작게 나오던 문제 대응.
 *   knowledge/ 폴더의 실제 와디즈 성공 사례 5건(톤별 1:1 매칭)을 실측하여
 *   getFontSizeGuide()에 톤별 크기·굵기 기준을 하드코딩, 두 패스 프롬프트에 주입.
 *   디자인 퀄리티 저하 시 위 백업 파일 내용으로 되돌릴 것.
 */
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 패스당 최대 이미지 슬롯 수 (8개 초과 시 다음 패스로 넘김)
const MAX_SLOTS_PER_PASS = 8;

const IMAGE_LINE_RE = /^\s*\(([^)]+)\)\s*$/;

// ─── 전처리 ─────────────────────────────────────────────────────────────────

// 실제 콘티 출력 포맷(system-prompt.ts E.0 / F.1-2): "## 제목" 3줄 → "**핵심
// 카피:**" 한 줄 → 그 뒤로 도입부/본론부/결론부가 "---" 구분선으로 나뉘고,
// 각 섹션은 "기획 의도"를 "> " 인용문 블록으로 먼저 쓴 다음 실제 콘티 본문이
// 이어진다. 제목·핵심 카피·기획 의도는 전략 설명용 메타 텍스트일 뿐 실제
// 판매 카피가 아니므로 디자인 생성 입력에 절대 포함되면 안 된다.
// (이전에는 "## 도입부 기획 의도" 같은, 실제로는 존재하지 않는 헤더를 찾는
// 로직을 썼다가 매번 매칭에 실패해 원문 전체가 그대로 디자인에 새어나갔다.)
function stripMetaFromConti(contiText: string): string {
  const lines = contiText.split("\n");

  // 첫 "> " 줄(도입부 기획 의도 시작) 이전은 전부 제목/핵심 카피 영역이므로 제외한다.
  const firstQuoteIdx = lines.findIndex((l) => l.trim().startsWith(">"));
  const bodyLines = firstQuoteIdx >= 0 ? lines.slice(firstQuoteIdx) : lines;

  // "---" 구분선 기준으로 도입부/본론부/결론부 3섹션으로 나눈다.
  const segments: string[][] = [[]];
  for (const line of bodyLines) {
    if (line.trim() === "---") {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(line);
    }
  }

  function extractContent(segLines: string[]): string {
    const contentLines: string[] = [];
    let inIntent = false;
    let intentDone = false;

    for (const line of segLines) {
      const trimmed = line.trim();

      if (!intentDone && trimmed.startsWith(">")) {
        inIntent = true;
        continue;
      }
      // 인용문 블록 안의 빈 줄은 구분자가 아니라 블록의 일부로 취급한다.
      if (inIntent && trimmed === "") continue;
      if (inIntent && !trimmed.startsWith(">")) {
        inIntent = false;
        intentDone = true;
      }
      // AI가 지침을 놓치고 제목·핵심카피를 본문 중간에 다시 쓰는 경우 방지.
      if (trimmed.startsWith("## ") || trimmed.startsWith("**핵심 카피:**")) continue;

      contentLines.push(line);
    }

    return contentLines.join("\n").trim();
  }

  const [introSeg = [], mainSeg = [], conclusionSeg = []] = segments;
  const combined = [extractContent(introSeg), extractContent(mainSeg), extractContent(conclusionSeg)]
    .filter((c) => c.length > 0)
    .join("\n\n---\n\n");

  // "> " 블록을 하나도 못 찾은 경우(예상 밖 포맷)에는 완전 누락보다 원문을
  // 그대로 쓰는 편이 안전하다.
  return combined || contiText;
}

function preprocessConti(contiText: string): { processedText: string; slotIds: string[] } {
  const sourceText = stripMetaFromConti(contiText);

  const allLines = sourceText.split("\n");

  let slotCounter = 0;
  const slotIds: string[] = [];
  const processedLines = allLines.map((line) => {
    const m = IMAGE_LINE_RE.exec(line);
    if (m) {
      const id = `placeholder_${slotCounter++}`;
      slotIds.push(id);
      return `[IMAGE:${id}|${m[1]}]`;
    }
    return line;
  });

  return { processedText: processedLines.join("\n"), slotIds };
}

// ─── 폰트 ────────────────────────────────────────────────────────────────────

function getGoogleFont(toneId: string, fontChoice: string): { importCss: string; fontFamily: string } {
  if (toneId === "premium" && (!fontChoice || fontChoice === "recommended")) {
    return {
      importCss: "@import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@300;400;500&display=swap');",
      fontFamily: "'Nanum Myeongjo', 'Noto Sans KR', Georgia, serif",
    };
  }
  if (fontChoice === "nanum") {
    return {
      importCss: "@import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap');",
      fontFamily: "'Nanum Gothic', sans-serif",
    };
  }
  return {
    importCss: "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');",
    fontFamily: "'Noto Sans KR', sans-serif",
  };
}

// ─── 텍스트 분할 ──────────────────────────────────────────────────────────────

/**
 * processedText를 슬롯 청크에 맞게 N개 조각으로 분할.
 * 각 청크의 마지막 슬롯 라인 직후에서 자른다.
 */
function splitTextBySlots(processedText: string, slotChunks: string[][]): string[] {
  if (slotChunks.length <= 1) return [processedText];

  const parts: string[] = [];
  let remaining = processedText;

  for (let i = 0; i < slotChunks.length - 1; i++) {
    const lastSlot = slotChunks[i][slotChunks[i].length - 1];
    const idx = remaining.indexOf(`[IMAGE:${lastSlot}|`);
    if (idx === -1) {
      parts.push(remaining);
      for (let j = i + 1; j < slotChunks.length; j++) parts.push("");
      return parts;
    }
    const lineEnd = remaining.indexOf("\n", idx);
    const splitAt = lineEnd === -1 ? remaining.length : lineEnd + 1;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  parts.push(remaining);
  return parts;
}

// ─── 톤별 폰트 크기 가이드 ─────────────────────────────────────────────────────
// 실제 와디즈 성공 사례(knowledge/ 폴더) 실측 기반. 톤별 reference:
// emotional=한일 이동식 에어컨, cinematic=Hey2 AI 안경, impact=젤리브라+선데이션,
// premium=ALLRESET 데님, minimal=신일 무선 BLDC팬

function getFontSizeGuide(toneId: string): string {
  if (toneId === "emotional" || toneId === "cinematic" || toneId === "impact") {
    return `FONT SIZE (STRICT — reference case for this tone uses uniform large bold copy throughout):
- ALL narrative copy lines — whether wrapped in **bold** or not — use the SAME large bold size: 55-70px, font-weight 800-900.
- ** markup changes COLOR (accent) or a highlight background only — it never makes text bigger than surrounding lines. Plain (non-**) lines must NOT be shrunk down to a "body text" size.
- Only truly secondary elements (small labels, fine print, disclaimers) may use a smaller size (16-20px).`;
  }
  if (toneId === "premium") {
    return `FONT SIZE (STRICT — reference case for this tone uses restrained editorial sizing):
- Narrative copy: 40-48px, regular/medium weight (NOT heavy bold), serif feel, generous line-height (1.4+) and whitespace between lines.
- Keep sizing modest and consistent — do NOT use the oversized poster-style headlines other tones use.`;
  }
  // minimal
  return `FONT SIZE (STRICT — reference case for this tone uses calm, modest sizing):
- Headline/hook lines: 40-48px, medium-bold (600-700); the key phrase may sit on a boxed/highlighted background.
- Regular body copy: 32-36px, medium weight (500) — noticeably smaller than the headline, but never below 32px.
- Small labels (e.g. "CHECK 01"): 14-16px, uppercase, muted/gray color.`;
}

// ─── 프롬프트 공통 헤더 ───────────────────────────────────────────────────────

const SHARED_CSS_CLASSES = `
SHARED CSS CLASS VOCABULARY (use these names consistently — second-pass sections reuse them):
.s-hero        full-width hero with image + text overlay
.s-hero-img    <img> inside hero (position:absolute, cover, full size)
.s-hero-text   text overlay inside hero (position:absolute, bottom/center, with padding)
.s-feature     feature item section (01/02/03 numbered)
.s-split       split/two-column section container (side-by-side flex layout)
.s-split-img   image element inside split section (width:50%, rounded, cover)
.s-split-text  text block container inside split section
.s-card        general content card
.s-grid        grid layout container (2-3 columns on desktop, 1 column on mobile)
.s-cta         CTA/closing section
.s-stat        large stat callout (80-120px number)
.s-bignum      decorative background number (opacity:0.08, 120-150px, position:absolute)
.s-alt         alternate background shade
.anim-fade     fadeUp animation (0.7s, fill:both)
.anim-zoom     zoomIn animation (0.7s, fill:both)
.badge         small accent pill
.accent-bar    left accent border bar
`.trim();

function getPredefinedCss(tone: ToneConfig, fontFamily: string): string {
  let typographyCss = "";
  if (tone.id === "emotional") {
    typographyCss = `
section p {
  font-size: clamp(28px, 5.5vw, 44px);
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.02em;
}
    `;
  } else if (tone.id === "cinematic") {
    typographyCss = `
section p {
  font-size: clamp(32px, 6vw, 52px);
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.02em;
}
strong {
  background: linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  color: var(--accent);
}
    `;
  } else if (tone.id === "impact") {
    typographyCss = `
section p {
  font-size: clamp(32px, 6vw, 52px);
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: -0.02em;
}
    `;
  } else if (tone.id === "premium") {
    typographyCss = `
section p {
  font-size: clamp(22px, 4.5vw, 36px);
  font-weight: 400;
  line-height: 1.55;
  letter-spacing: -0.01em;
}
    `;
  } else { // minimal
    typographyCss = `
section p {
  font-size: clamp(18px, 3.5vw, 26px);
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: -0.01em;
}
h1, h2, h3, .s-headline {
  font-size: clamp(24px, 5vw, 40px);
  font-weight: 700;
  color: var(--text);
  line-height: 1.35;
}
    `;
  }

  return `
/* Base Structure */
section {
  position: relative;
  padding: 80px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
}
section.s-alt {
  background-color: color-mix(in srgb, var(--accent) 4%, var(--bg));
}

/* Typography Specifics */
${typographyCss}

section p.small, section p.desc, section p.label, section p.s-small {
  font-size: 16px !important;
  font-weight: 400 !important;
  line-height: 1.5 !important;
  opacity: 0.6 !important;
}

/* Hero Section */
.s-hero {
  position: relative;
  padding: 0;
  min-height: 520px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.s-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}
.s-hero-text {
  position: relative;
  z-index: 2;
  padding: 48px 24px 80px 24px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%);
}
.s-hero-text, .s-hero-text * {
  color: #ffffff !important;
}
.s-hero-text strong {
  color: var(--accent) !important;
}

/* Split Section */
.s-split {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 32px;
  padding: 60px 24px;
}
.s-split-reverse {
  flex-direction: row-reverse;
}
.s-split > * {
  flex: 1;
  min-width: 0;
}
.s-split-img {
  width: 100%;
  height: auto;
  aspect-ratio: 1/1;
  object-fit: cover;
  border-radius: 16px;
  display: block;
}
.s-split-text {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (max-width: 640px) {
  .s-split, .s-split-reverse {
    flex-direction: column;
    gap: 24px;
  }
  .s-split-img {
    aspect-ratio: 4/3;
  }
}

/* Grid Section */
.s-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  width: 100%;
}

/* General Content Card */
.s-card {
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  border-radius: 20px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.s-card:hover {
  transform: translateY(-2px);
}
.s-card .slot {
  border-radius: 12px;
  aspect-ratio: 16/10;
  object-fit: cover;
  width: 100%;
  margin-bottom: 8px;
}

/* Feature Section */
.s-feature {
  padding: 60px 24px;
}

/* CTA / Closing Section */
.s-cta {
  text-align: center;
  padding: 100px 24px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg));
  align-items: center;
  justify-content: center;
}

/* Large Stat Callout */
.s-stat {
  font-size: clamp(64px, 14vw, 110px);
  font-weight: 900;
  color: var(--accent);
  line-height: 1;
  letter-spacing: -0.03em;
  font-family: sans-serif;
}

/* Decorative Background Number */
.s-bignum {
  position: absolute;
  right: 24px;
  top: 16px;
  font-size: 140px;
  font-weight: 900;
  color: var(--accent);
  opacity: 0.07;
  line-height: 1;
  pointer-events: none;
  font-family: sans-serif;
}

/* Utility Elements */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 9999px;
  width: fit-content;
}
.accent-bar {
  width: 44px;
  height: 4px;
  background-color: var(--accent);
  border-radius: 2px;
}
.anim-fade {
  animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.anim-zoom {
  animation: zoomIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
  `.trim();
}

function buildToneHeader(tone: ToneConfig, fontFamily: string): string {
  return `World-class Korean e-commerce detail page designer for Wadiz crowdfunding.

TONE: ${tone.name} / ${tone.mood}
--bg:${tone.background}  --text:${tone.textColor}  --accent:${tone.accentColor}
Font: ${fontFamily}

CRITICAL: ALL CSS in one <style> block. NEVER use style="" attributes.
IMAGE SLOTS: [IMAGE:placeholder_N|desc] → <img class="slot" data-slot="placeholder_N" src="" alt="">
- CRITICAL: The description ('desc') must ONLY be used as the 'alt' attribute of the img tag.
- NEVER render the 'desc' text as visible HTML text (such as text labels, captions, <p>, or <span> tags) under or near the image.
BOLD: **text** → <strong>text</strong>
SECTION STRUCTURE: <section id="section-N"> (one per topic/image/feature-point)

LINE BREAKS (STRICT): The copywriter pre-broke CONTENT into lines for exact reading rhythm.
- Preserve every line break in CONTENT literally: render each CONTENT line as its own line (e.g. separate <br>-divided segment or its own element) inside the block.
- NEVER merge two separate CONTENT lines into one flowing sentence/line.
- NEVER let CSS word-wrap split a single CONTENT line across two visual rows. If a line is long, shrink that line's font-size (clamp() or a smaller class) so it fits on one row — do not allow an extra wrap to appear.

${getFontSizeGuide(tone.id)}

STRICT CONTENT RULE: Use ONLY the text provided in CONTENT below.
- Do NOT invent, add, or embellish any copy, branding, slogans, badges, or labels not explicitly written in CONTENT.
- Do NOT add "×", collaboration names, platform badges (e.g. "슈퍼메이커", "와디즈 추천"), certifications, award labels, or any promotional text unless it appears verbatim in CONTENT.
- Do NOT add decorative intro phrases like "쉔코리아 × 와디즈" or similar brand mashups.
- To write secondary small text (fine print, label, disclaimer), wrap it in <p class="small"> or <p class="desc"> (16px).`;
}

// ─── 1차 패스: 완전한 HTML 문서 ──────────────────────────────────────────────

async function generateFirstPass(
  tone: ToneConfig,
  importCss: string,
  fontFamily: string,
  textChunk: string,
  chunkSlotIds: string[],
  allSlotIds: string[],
  startSectionN: number
): Promise<string> {
  const predefinedCss = getPredefinedCss(tone, fontFamily);
  const systemText = `${buildToneHeader(tone, fontFamily)}

Generate a COMPLETE HTML document for PART 1 of the product page.

HEAD TEMPLATE — copy this exactly, then you can add your own custom CSS overrides/classes inside the <style> if needed:
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${importCss}
${predefinedCss}
/* YOUR CUSTOM CSS CLASSES/OVERRIDES BELOW (IF ANY) — keep total custom CSS under 50 lines, no CSS comments */
</style>
</head>
<body>

${SHARED_CSS_CLASSES}

CSS BUDGET: Predefined layout and typography classes are already included. You may add your own custom CSS classes or overrides below (keep custom CSS under 50 lines total, no CSS comments).
Use shorthand. Reuse classes. Second-pass sections will inherit all classes defined here.

DESIGN:
- Hero section: full-width image with overlaid headline (absolute positioning via .s-hero classes)
- Stats: 80-120px numbers using .s-stat
- Features: giant decorative background number (0.08 opacity) using .s-bignum using .s-feature classes
- Alternate backgrounds: every other section uses .s-alt
- Accent color for badges, borders, underlines

End with </body></html>. Return ONLY the HTML document. No markdown fences.`;

  const userText = `SECTION IDs: start from section-${startSectionN}

CONTENT FOR THIS PART:
${textChunk}

Slots in this part: ${chunkSlotIds.join(", ")}
All slots in document: ${allSlotIds.join(", ")}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn("[html-design-ai] First pass hit max_tokens — consider reducing content size");
  }

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  return raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
}

// ─── 후속 패스: 섹션 조각만 생성 ────────────────────────────────────────────

async function generateSubsequentPass(
  tone: ToneConfig,
  textChunk: string,
  chunkSlotIds: string[],
  startSectionN: number,
  passIndex: number
): Promise<string> {
  if (!textChunk.trim()) return "";

  const systemText = `You are generating ADDITIONAL SECTIONS for a Korean product detail page.

OUTPUT RULES:
- Output ONLY raw <section id="section-N">...</section> blocks
- Do NOT output DOCTYPE, html, head, body, or style tags
- Use the SAME CSS classes defined in Part 1: ${SHARED_CSS_CLASSES}
- Do NOT add any new <style> block
- ALL images: <img class="slot" data-slot="placeholder_N" src="" alt="">
- CRITICAL: Never output the 'desc' description as visible text on the screen. It must only reside in the 'alt' attribute.
- **text** → <strong>text</strong>
- No inline style="" attributes
- STRICT CONTENT RULE: Use ONLY text from CONTENT below. Do NOT invent branding, badges, slogans, collaboration names, or any copy not explicitly in CONTENT.
- LINE BREAKS (STRICT): Preserve every line break in CONTENT literally (one CONTENT line = one rendered line, e.g. via <br>). Never merge two CONTENT lines into one sentence, and never let CSS word-wrap split a single CONTENT line across two rows — shrink font-size instead.
- To write secondary small text (fine print, label, disclaimer), wrap it in <p class="small"> or <p class="desc"> (16px).

${getFontSizeGuide(tone.id)}

TONE VARS (already in CSS): --bg:${tone.background} --text:${tone.textColor} --accent:${tone.accentColor}`;

  const userText = `Part ${passIndex + 1}. Section IDs start at section-${startSectionN} and increment.

CONTENT:
${textChunk}

Slots in this part: ${chunkSlotIds.length > 0 ? chunkSlotIds.join(", ") : "(없음)"}

Return ONLY the <section> elements. No explanation. No markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn(`[html-design-ai] Pass ${passIndex + 1} hit max_tokens`);
  }

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  return raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
}

// ─── 섹션 ID 카운터 파싱 ────────────────────────────────────────────────────

function getMaxSectionN(html: string): number {
  const matches = [...html.matchAll(/id="section-(\d+)"/g)];
  if (matches.length === 0) return -1;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

// ─── 메인 생성 함수 ──────────────────────────────────────────────────────────

export async function generateHtmlDesign(
  contiText: string,
  toneId: string,
  fontChoice: string
): Promise<HtmlDesignResult> {
  const tone = getToneById(toneId);
  if (!tone) throw new Error(`알 수 없는 톤: ${toneId}`);

  const { processedText, slotIds } = preprocessConti(contiText);
  const { importCss, fontFamily } = getGoogleFont(toneId, fontChoice);

  // 슬롯을 MAX_SLOTS_PER_PASS개씩 청크로 나눔
  const slotChunks: string[][] = [];
  if (slotIds.length === 0) {
    slotChunks.push([]);
  } else {
    for (let i = 0; i < slotIds.length; i += MAX_SLOTS_PER_PASS) {
      slotChunks.push(slotIds.slice(i, i + MAX_SLOTS_PER_PASS));
    }
  }

  const textChunks = splitTextBySlots(processedText, slotChunks);

  console.log(`[html-design-ai] slots=${slotIds.length}, passes=${slotChunks.length}`);
  console.log(`[html-design-ai][DEBUG] processedText head:\n${processedText.slice(0, 400)}`);

  // ── 1차 패스: 완전한 HTML 문서 ──
  const firstHtml = await generateFirstPass(
    tone, importCss, fontFamily,
    textChunks[0], slotChunks[0], slotIds,
    0
  );

  if (slotChunks.length === 1) {
    // 단일 패스
    const sectionIds = extractSectionIds(firstHtml);
    return { fullHtml: firstHtml, sectionIds, generatedAt: Date.now() };
  }

  // ── 후속 패스: 섹션 조각 생성 후 병합 ──
  let fullHtml = firstHtml;

  for (let i = 1; i < slotChunks.length; i++) {
    if (!textChunks[i]?.trim()) continue;

    const startN = getMaxSectionN(fullHtml) + 1;
    const sections = await generateSubsequentPass(
      tone,
      textChunks[i],
      slotChunks[i],
      startN,
      i
    );

    if (sections) {
      // </body> 직전에 삽입
      fullHtml = fullHtml.replace(/<\/body>[\s\S]*$/, sections + "\n</body></html>");
    }
  }

  const sectionIds = extractSectionIds(fullHtml);
  return { fullHtml, sectionIds, generatedAt: Date.now() };
}

function extractSectionIds(html: string): string[] {
  const sectionIds: string[] = [];
  const re = /id="(section-\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!sectionIds.includes(m[1])) sectionIds.push(m[1]);
  }
  return sectionIds;
}

// ─── 섹션 수정 ───────────────────────────────────────────────────────────────

export async function editSectionHtml(
  sectionHtml: string,
  instruction: string,
  toneId: string
): Promise<string> {
  const tone = getToneById(toneId);
  const accentColor = tone?.accentColor ?? "#000000";

  const systemText = `You are editing one section of a Korean product detail page.

Apply the instruction. Preserve HTML structure, CSS classes, IDs, and data-slot attributes unless asked to change them.
BOLD: **text** → <strong style="color:${accentColor}">text</strong>
No new style="" attributes. No new <style> blocks.`;

  const userText = `CURRENT SECTION:
${sectionHtml}

INSTRUCTION: "${instruction}"

Return ONLY the updated <section>...</section>. No explanation. No markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  return raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
}
