import Anthropic from "@anthropic-ai/sdk";
import { HtmlDesignResult } from "./types";
import { getToneById, ToneConfig } from "@/components/design-system/tones";
import { parseSections } from "./format-output";

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

// 콘티에서 실제 판매 카피(도입부/본론부/결론부 본문)만 뽑아 디자인 생성
// 입력으로 넘긴다. 제목·핵심 카피·기획 의도는 전략 설명용 메타 텍스트일 뿐
// 실제 판매 카피가 아니므로 디자인 생성 입력에 절대 포함되면 안 된다.
//
// 화면에 도입부/본론부/결론부를 나눠 보여줄 때 이미 쓰고 있는 parseSections()를
// 그대로 재사용한다 — "도입부"/"본론부"/"결론부" 헤더와 "기획 의도" 여부로
// 판단하므로, 콘티 안에 "---" 구분선이 몇 번 나오든(예: 각 섹션의 기획 의도
// 앞뒤로 추가로 나오는 경우) 흔들리지 않는다.
// (이전에는 "---"가 나올 때마다 새 덩어리로 나눠 앞의 3개만 쓰는 방식이었는데,
// 실제 콘티에는 "---"가 섹션 전환 지점 외에도 더 나와서 본론부·결론부가
// 통째로 누락되는 문제가 있었다.)
function stripMetaFromConti(contiText: string): string {
  const { intro, main, conclusion } = parseSections(contiText);

  const combined = [intro.content, main.content, conclusion.content]
    .filter((c) => c.length > 0)
    .join("\n\n---\n\n");

  // 세 섹션을 하나도 못 찾은 경우(예상 밖 포맷)에는 완전 누락보다 원문을
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
.s-card        general content card
.s-grid        grid layout container (2-3 columns on desktop, 1 column on mobile)
.s-cta         CTA/closing section
.s-stat        large stat callout (80-120px number)
.s-bignum      decorative background number (opacity:0.08, 120-150px, position:absolute)
.s-alt         alternate background shade
.anim-fade     fadeUp animation (0.7s, fill:both)
.anim-zoom     zoomIn animation (0.7s, fill:both)
.badge         small accent pill
.accent-bar    small decorative bar ONLY (44px×4px fixed size) — NEVER put text/image inside it or use it as a content wrapper. Always use it standalone and empty: <div class="accent-bar"></div>
.i-divider     short, subtle horizontal pause divider (32px×2px, low opacity, aligned with surrounding text — not centered). A standalone "I" line in CONTENT is NOT the letter I — it marks a rhythm break, and is a rare last resort (see copy rules — should barely ever appear). Render it as <div class="i-divider"></div>, never as visible text "I".
.s-point-label body-section subheading label — fixed size already defined in <style> (bigger and bolder than regular narrative copy, accent color). NEVER set your own font-size/color for it. A CONTENT line starting with "Point N. " (N = number) is this label: render "POINT N" as <div class="s-point-label">POINT N</div> on its own, then render the rest (the text after "Point N. " on that line, plus any further CONTENT lines that continue the same title with no blank line in between) as a plain <p> right below it with NO class and NO font-size override. This <p> follows the exact same LINE BREAKS rule as regular content below — keep each given CONTENT line's own <br> exactly as written, never merge them into one flowing line, and never let CSS word-wrap split a single given line; if one given line alone still doesn't fit, shrink this <p>'s font-size (never below 35px) instead of letting it wrap.
.s-card-title  headline/emphasis text inside .s-card (e.g. a USP card in .s-grid) — fixed size already defined in <style>, pre-tuned to the card's OWN width (not the viewport), with a 35px floor built in. Any <p> that is a bold headline/emphasis line inside a .s-card MUST use <p class="s-card-title"> and MUST NOT have any inline style="" or a flat px font-size — cards are much narrower than the full screen, so a viewport-sized or hand-picked px value will overflow and wrap word-by-word. Regular (non-headline) body text inside a .s-card still uses the normal unclassed <p>.
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
.s-point-label {
  font-size: clamp(70px, 9vw, 90px);
  font-weight: 900;
  color: var(--accent);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.s-card-title {
  font-size: clamp(35px, 15cqw, 46px);
  font-weight: 800;
  line-height: 1.3;
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
.s-point-label {
  font-size: clamp(70px, 9vw, 90px);
  font-weight: 900;
  color: var(--accent);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.s-card-title {
  font-size: clamp(35px, 15cqw, 46px);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.02em;
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
.s-point-label {
  font-size: clamp(70px, 9vw, 90px);
  font-weight: 900;
  color: var(--accent);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.s-card-title {
  font-size: clamp(35px, 15cqw, 46px);
  font-weight: 800;
  line-height: 1.3;
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
.s-point-label {
  font-size: clamp(52px, 7vw, 64px);
  font-weight: 700;
  color: var(--accent);
  line-height: 1.2;
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}
.s-card-title {
  font-size: clamp(35px, 13cqw, 40px);
  font-weight: 700;
  line-height: 1.35;
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
.s-point-label {
  font-size: clamp(48px, 6vw, 60px);
  font-weight: 800;
  color: var(--accent);
  line-height: 1.2;
  letter-spacing: -0.01em;
  margin-bottom: 8px;
}
.s-card-title {
  font-size: clamp(35px, 12cqw, 38px);
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
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
  word-break: keep-all;
  overflow-wrap: break-word;
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
  container-type: inline-size;
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
.i-divider {
  width: 32px;
  height: 2px;
  background-color: var(--accent);
  opacity: 0.35;
  border-radius: 2px;
  margin: 8px 0;
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
"I" DIVIDER: A line that is exactly the single character "I" (nothing else) is a rhythm-pause marker, NOT the letter I. Render it as <div class="i-divider"></div> — never output it as visible text.
POINT LABEL (STRICT): A CONTENT line starting with "Point N. " is a body-section subheading. Split it: render "POINT N" as <div class="s-point-label">POINT N</div> alone, then render the rest of that line (after "Point N. ") as a plain <p> right after, with NO class and NO font-size/style override of any kind. Every Point subheading must render at the exact same size regardless of text length — this <p> is EXEMPT from the "shrink long lines to fit one row" rule below; if it's long, let it wrap onto two lines instead of shrinking the font. DEFENSIVE CASE: if the copywriter's "Point N. " line was mistakenly broken across more than one CONTENT line (the very next CONTENT line, with no blank line before it, is clearly a continuation of the same subheading phrase, not a new independent sentence), treat that next line as part of the SAME Point subheading too — keep it inside the same plain <p> (joined with <br> if needed), still with no class/style override, NOT as a separate narrative-copy paragraph.

LAYOUT (STRICT): NEVER place an image side-by-side with text in a horizontal split (image on one side, text column on the other). Always stack: image above or below the text, full width. This applies to every section, no exceptions.

LINE BREAKS (STRICT): The copywriter pre-broke CONTENT into lines for exact reading rhythm. Grouping is based PURELY on blank lines — never on grammar or how many lines are involved:
- Lines with NO blank line between them (no matter how many, no matter whether each one reads as a complete sentence) all belong to the SAME group — render them together inside ONE <p>, separated only by <br>, with NO extra spacing between them.
- A blank line in CONTENT marks a NEW group — start a fresh <p> for the lines that follow, as its own direct child of the section (this naturally gets the section's own larger spacing from its gap).
- NEVER render individual lines from the same blank-line-delimited group as separate <p> siblings — that creates a huge unwanted gap that shouldn't be there.
- NEVER merge two separate CONTENT lines into one flowing sentence/line — keep each line's own <br> break.
- NEVER let CSS word-wrap split a single CONTENT line across two visual rows. If a line is long, shrink that line's font-size (clamp() or a smaller class) so it fits on one row — do not shrink below a readable minimum (e.g. never under 35px for narrative copy), and do not allow an extra wrap to appear.
- INSIDE .s-card: this "shrink font-size" fix must NEVER be done with an inline style="" or a hand-picked px number — a .s-card is much narrower than the viewport (especially in a multi-column .s-grid), so a viewport-scaled or guessed size will overflow and wrap word-by-word. Use the pre-tuned <p class="s-card-title"> class instead (see class vocabulary) for any bold headline/emphasis line inside a card.

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
- "I" DIVIDER: A line that is exactly the single character "I" (nothing else) is a rhythm-pause marker, NOT the letter I. Render it as <div class="i-divider"></div> — never output it as visible text.
- POINT LABEL (STRICT): A CONTENT line starting with "Point N. " is a body-section subheading. Split it: render "POINT N" as <div class="s-point-label">POINT N</div> alone, then render the rest of that line (after "Point N. ") as a plain <p> right after, with NO class and NO font-size/style override of any kind. Every Point subheading must render at the exact same size regardless of text length — this <p> is EXEMPT from the "shrink long lines to fit one row" rule below; if it's long, let it wrap onto two lines instead of shrinking the font. DEFENSIVE CASE: if the copywriter's "Point N. " line was mistakenly broken across more than one CONTENT line (the very next CONTENT line, with no blank line before it, is clearly a continuation of the same subheading phrase, not a new independent sentence), treat that next line as part of the SAME Point subheading too — keep it inside the same plain <p> (joined with <br> if needed), still with no class/style override, NOT as a separate narrative-copy paragraph.
- LAYOUT (STRICT): NEVER place an image side-by-side with text in a horizontal split (image on one side, text column on the other). Always stack: image above or below the text, full width. This applies to every section, no exceptions.
- LINE BREAKS (STRICT): Grouping is based PURELY on blank lines, never on grammar. Lines with no blank line between them (however many, regardless of whether each reads as a complete sentence) all belong to the SAME group — render together in ONE <p>, separated only by <br>, no extra spacing. A blank line marks a NEW group — start a fresh <p> as its own direct child of the section (gets the section's larger spacing naturally). Never render lines from the same blank-line-delimited group as separate <p> siblings. Never merge two lines into one flowing sentence, and never let CSS word-wrap split a single line across two rows — shrink font-size instead, but never below a readable minimum (e.g. never under 35px for narrative copy). Inside a .s-card, never fix this with inline style="" or a hand-picked px number — use <p class="s-card-title"> instead, which is already pre-tuned to the card's own (narrow) width.
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
    const verifiedHtml = await verifyAndFixCardLayouts(firstHtml, toneId);
    const sectionIds = extractSectionIds(verifiedHtml);
    return { fullHtml: verifiedHtml, sectionIds, generatedAt: Date.now() };
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

  const verifiedHtml = await verifyAndFixCardLayouts(fullHtml, toneId);
  const sectionIds = extractSectionIds(verifiedHtml);
  return { fullHtml: verifiedHtml, sectionIds, generatedAt: Date.now() };
}

// ─── 카드 레이아웃 검증·자동 보정 ─────────────────────────────────────────────
// 카드(.s-card) 안 헤드라인(.s-card-title)이 콘티의 원래 줄 구성(<br> 기준)보다
// 더 많은 줄로 쪼개져 렌더링되는지 실제 헤드리스 브라우저로 렌더링해 확인하고,
// 문제가 있으면 그 섹션만 AI에게 다시 그리게 한다. 최대 2회 시도 후 종료.
async function verifyAndFixCardLayouts(fullHtml: string, toneId: string): Promise<string> {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error("[verify-card-layout] 헤드리스 브라우저 실행 실패, 검증 건너뜀:", err);
    return fullHtml;
  }

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
    // 실제 웹폰트가 다 로드된 뒤에 측정해야 줄바꿈 판정이 매번 같게 나온다.
    await page.evaluate(() => (document as Document).fonts.ready).catch(() => {});

    for (let attempt = 0; attempt < 2; attempt++) {
      const brokenSectionIds: string[] = await page.evaluate(() => {
        const ids = new Set<string>();
        document.querySelectorAll("p.s-card-title").forEach((p) => {
          const intendedLines = p.innerHTML.split(/<br\s*\/?>/i).length;
          const range = document.createRange();
          range.selectNodeContents(p);
          const actualLines = Array.from(range.getClientRects()).filter((r) => r.width > 0).length;
          const overflowing = p.scrollWidth > p.clientWidth + 1;
          if (actualLines > intendedLines || overflowing) {
            const section = p.closest("section[id]");
            if (section) ids.add(section.id);
          }
        });
        return Array.from(ids);
      });

      if (brokenSectionIds.length === 0) break;

      for (const sectionId of brokenSectionIds) {
        const sectionHtml: string | null = await page.evaluate((id) => {
          const el = document.getElementById(id);
          return el ? el.outerHTML : null;
        }, sectionId);
        if (!sectionHtml) continue;

        console.log(`[verify-card-layout] ${sectionId} 카드 줄바꿈/넘침 불일치 감지, 재생성 시도 ${attempt + 1}`);
        const instruction =
          "이 섹션 안 카드형 레이아웃에서 카드 폭이 좁아 헤드라인 텍스트가 원래 줄 구성(현재 <br>로 표시된 줄 수)보다 더 많은 줄로 갈라지거나, 카드 밖으로 옆으로 넘쳐서 렌더링되고 있다. 콘티의 원래 줄바꿈이 그대로 유지되도록 카드 배치나 디자인 방식을 판단해서 이 섹션을 다시 만들어라 (카드 열 수를 줄이거나 세로로 쌓는 등 방법은 자유롭게 선택하되): 1) 각 카드 헤드라인의 줄 구성이 지금보다 더 많은 줄로 갈라지면 안 된다, 2) 글자 크기는 35px 밑으로 내려가면 안 된다, 3) white-space:nowrap이나 overflow:hidden 등으로 줄 수만 맞추고 실제로는 텍스트가 카드 박스 밖으로 넘치거나 잘리게 하는 편법은 절대 쓰지 마라 — 텍스트 전체가 카드 안에 실제로 온전히 보여야 한다, 4) 카드 열 수는 화면 폭에 따라 자동으로 반응하도록(예: repeat(auto-fit, minmax(...))) 유지하고, 화면 폭과 무관하게 항상 1열로 고정되는 값(grid-template-columns:1fr 같은)은 쓰지 마라, 5) 이미지 슬롯과 텍스트 내용은 그대로 유지하라.";

        try {
          const fixedSectionHtml = await editSectionHtml(sectionHtml, instruction, toneId);
          await page.evaluate(
            ({ id, html }) => {
              const el = document.getElementById(id);
              if (el) el.outerHTML = html;
            },
            { id: sectionId, html: fixedSectionHtml }
          );
        } catch (err) {
          console.error(`[verify-card-layout] ${sectionId} 자동 보정 실패:`, err);
        }
      }
    }

    // 최종 안전장치: AI 재시도로도 안 고쳐졌으면 코드가 직접 강제 교정한다.
    // (인라인 스타일을 전부 제거해 톤별로 미리 튜닝된 .s-card-title/.s-grid/.s-card
    //  기본(반응형) 스타일로 되돌린다 — 화면 폭에 따라 열 수가 자동으로 반응하는
    //  원래 동작은 유지하면서, 최소 글자 크기·넘침 없음만 보장한다. 화면 폭과
    //  무관하게 특정 열 수로 고정하지 않는다.)
    const forcedFixes: string[] = await page.evaluate(() => {
      const fixed: string[] = [];
      document.querySelectorAll("p.s-card-title").forEach((p) => {
        const intendedLines = p.innerHTML.split(/<br\s*\/?>/i).length;
        const range = document.createRange();
        range.selectNodeContents(p);
        const actualLines = Array.from(range.getClientRects()).filter((r) => r.width > 0).length;
        const overflowing = p.scrollWidth > p.clientWidth + 1;
        if (actualLines <= intendedLines && !overflowing) return;

        fixed.push(p.textContent?.slice(0, 20) ?? "");
        p.removeAttribute("style");
        const grid = p.closest(".s-grid") as HTMLElement | null;
        if (grid) grid.removeAttribute("style");
        const card = p.closest(".s-card") as HTMLElement | null;
        if (card) card.removeAttribute("style");
      });
      return fixed;
    });
    if (forcedFixes.length > 0) {
      console.log(`[verify-card-layout] 코드 강제 교정 적용 (${forcedFixes.length}건): ${forcedFixes.join(", ")}`);
    }

    return await page.content();
  } finally {
    await browser.close();
  }
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

// ─── 카피 문단 수정 ──────────────────────────────────────────────────────────

export async function editCopyHtml(
  copyHtml: string,
  instruction: string,
  toneId: string
): Promise<string> {
  const tone = getToneById(toneId);
  const accentColor = tone?.accentColor ?? "#000000";

  const systemText = `You are editing one paragraph of copy text within a Korean product detail page.

Apply the instruction. Preserve the <p> tag itself, its class and attributes, unless asked to change them.
BOLD: **text** → <strong style="color:${accentColor}">text</strong>
No new style="" attributes. No new <style> blocks.`;

  const userText = `CURRENT PARAGRAPH:
${copyHtml}

INSTRUCTION: "${instruction}"

Return ONLY the updated <p>...</p>. No explanation. No markdown fences.`;

  const copyResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const copyRaw = copyResponse.content[0].type === "text" ? copyResponse.content[0].text : "";
  return copyRaw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
}
