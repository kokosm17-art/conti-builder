import Anthropic from "@anthropic-ai/sdk";
import { HtmlDesignResult } from "./types";
import { getToneById, ToneConfig } from "@/components/design-system/tones";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 패스당 최대 이미지 슬롯 수 (8개 초과 시 다음 패스로 넘김)
const MAX_SLOTS_PER_PASS = 8;

const IMAGE_LINE_RE = /^\s*\(([^)]+)\)\s*$/;

// ─── 전처리 ─────────────────────────────────────────────────────────────────

function preprocessConti(contiText: string): { processedText: string; slotIds: string[] } {
  const allLines = contiText.split("\n");
  const introIdx = allLines.findIndex((l) => /^#{1,6}.*도입부/.test(l.trim()));
  const lines = introIdx >= 0 ? allLines.slice(introIdx) : allLines;

  let slotCounter = 0;
  const slotIds: string[] = [];
  const processedLines = lines.map((line) => {
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

// ─── 프롬프트 공통 헤더 ───────────────────────────────────────────────────────

const SHARED_CSS_CLASSES = `
SHARED CSS CLASS VOCABULARY (use these names consistently — second-pass sections reuse them):
.s-hero       full-width hero with image + text overlay
.s-hero-img   <img> inside hero (position:absolute, cover, full size)
.s-hero-text  text overlay (position:absolute, bottom/center, with padding)
.s-feature    feature item section (01/02/03 numbered)
.s-bignum     decorative background number (opacity:0.08, 120-150px, position:absolute)
.s-stat       large stat callout (80-120px number)
.s-card       general content card
.s-cta        CTA/closing section
.s-alt        alternate background shade
.anim-fade    fadeUp animation (0.7s, fill:both)
.anim-zoom    zoomIn animation (0.7s, fill:both)
.badge        small accent pill
.accent-bar   left accent border bar
`.trim();

function buildToneHeader(tone: ToneConfig, importCss: string, fontFamily: string): string {
  return `World-class Korean e-commerce detail page designer for Wadiz crowdfunding.

TONE: ${tone.name} / ${tone.mood}
--bg:${tone.background}  --text:${tone.textColor}  --accent:${tone.accentColor}
Font: ${fontFamily}

CRITICAL: ALL CSS in one <style> block. NEVER use style="" attributes.
IMAGE SLOTS: [IMAGE:placeholder_N|desc] → <img class="slot" data-slot="placeholder_N" src="" alt="">
BOLD: **text** → <strong>text</strong>
SECTION STRUCTURE: <section id="section-N"> (one per topic/image/feature-point)

STRICT CONTENT RULE: Use ONLY the text provided in CONTENT below.
- Do NOT invent, add, or embellish any copy, branding, slogans, badges, or labels not explicitly written in CONTENT.
- Do NOT add "×", collaboration names, platform badges (e.g. "슈퍼메이커", "와디즈 추천"), certifications, award labels, or any promotional text unless it appears verbatim in CONTENT.
- Do NOT add decorative intro phrases like "쉔코리아 × 와디즈" or similar brand mashups.`;
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
  const prompt = `${buildToneHeader(tone, importCss, fontFamily)}

Generate a COMPLETE HTML document for PART 1 of the product page.

HEAD TEMPLATE — copy this exactly, then add your CSS classes inside the <style>:
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${importCss}
:root{--bg:${tone.background};--text:${tone.textColor};--accent:${tone.accentColor}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:${fontFamily};background:var(--bg);color:var(--text);max-width:750px;margin:0 auto;word-break:keep-all;overflow-wrap:break-word}
strong{color:var(--accent)}
img.slot{width:100%;display:block;object-fit:cover}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes zoomIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
/* YOUR CSS CLASSES BELOW — keep total <style> under 80 lines, no CSS comments */
</style>
</head>
<body>

${SHARED_CSS_CLASSES}

CSS BUDGET: Keep <style> UNDER 80 LINES TOTAL (including the base styles above).
Use shorthand. Reuse classes. Second-pass sections will inherit all classes defined here.

SECTION IDs: start from section-${startSectionN}
DESIGN:
- Hero section: full-width image with overlaid headline (absolute positioning via .s-hero classes)
- Stats: 80-120px numbers
- Features: giant decorative background number (0.08 opacity) using .s-bignum
- Alternate backgrounds: every other section uses .s-alt
- Accent color for badges, borders, underlines

CONTENT FOR THIS PART:
${textChunk}

Slots in this part: ${chunkSlotIds.join(", ")}
All slots in document: ${allSlotIds.join(", ")}

End with </body></html>. Return ONLY the HTML document. No markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
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

  const prompt = `You are generating ADDITIONAL SECTIONS for a Korean product detail page (Part ${passIndex + 1}).

OUTPUT RULES:
- Output ONLY raw <section id="section-N">...</section> blocks
- Do NOT output DOCTYPE, html, head, body, or style tags
- Section IDs start at section-${startSectionN} and increment
- Use the SAME CSS classes defined in Part 1: ${SHARED_CSS_CLASSES}
- Do NOT add any new <style> block
- ALL images: <img class="slot" data-slot="placeholder_N" src="" alt="">
- **text** → <strong>text</strong>
- No inline style="" attributes
- STRICT CONTENT RULE: Use ONLY text from CONTENT below. Do NOT invent branding, badges, slogans, collaboration names, or any copy not explicitly in CONTENT.

TONE VARS (already in CSS): --bg:${tone.background} --text:${tone.textColor} --accent:${tone.accentColor}

CONTENT:
${textChunk}

Slots in this part: ${chunkSlotIds.length > 0 ? chunkSlotIds.join(", ") : "(없음)"}

Return ONLY the <section> elements. No explanation. No markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
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

  const prompt = `You are editing one section of a Korean product detail page.

Apply the instruction. Preserve HTML structure, CSS classes, IDs, and data-slot attributes unless asked to change them.
BOLD: **text** → <strong style="color:${accentColor}">text</strong>
No new style="" attributes. No new <style> blocks.

CURRENT SECTION:
${sectionHtml}

INSTRUCTION: "${instruction}"

Return ONLY the updated <section>...</section>. No explanation. No markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  return raw.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
}
