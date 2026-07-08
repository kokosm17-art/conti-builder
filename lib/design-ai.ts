import Anthropic from "@anthropic-ai/sdk";
import { DesignSection, LayoutType, MotionTemplateType, TextHierarchy } from "./types";
import { parseContiBlocks } from "./conti-parser";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export { parseContiBlocks, PLACEHOLDER_RE } from "./conti-parser";

// ─── AI 레이아웃 결정 ───────────────────────────────────────────────────────

interface AILayoutDecision {
  id: string;
  layout: LayoutType;
  textHierarchy: TextHierarchy;
  lineHierarchies?: TextHierarchy[];
  textColorOverride?: string;
  motionTemplate: MotionTemplateType;
  splitDirection?: "text-left" | "text-right";
  cardCount?: 2 | 3;
}

export async function generateDesignLayout(
  contiText: string,
  toneId: string,
  uploadedImageCount: number
): Promise<DesignSection[]> {
  const blocks = parseContiBlocks(contiText);
  if (blocks.length === 0) return [];

  // 패턴 감지 정규식 (렌더러와 동일)
  const FEATURE_NUM_RE = /^(0[1-9]|[1-9][0-9]?)\.?$/;
  const STAT_RE = /^[\d,\.][\d,\.\s]*[억만천원개명%회년배+·~]*\+?$/u;

  const compactBlocks = blocks.map((b) => ({
    id: b.id,
    // 최대 5줄 · 150자로 더 많은 컨텍스트 전달
    text: b.textLines.slice(0, 5).join(" | ").substring(0, 150),
    hasImage: b.imageSlotIndex !== null,
    lineCount: b.textLines.length,
    // "01", "02" 등 넘버 피처 첫 줄 여부
    startsWithNum: FEATURE_NUM_RE.test(b.textLines[0]?.trim() ?? ""),
    // "400억", "99.9%" 등 수치 callout 줄 포함 여부
    hasStat: b.textLines.some((l) => STAT_RE.test(l.trim())),
  }));

  const prompt = `You are a Korean e-commerce page layout designer for Wadiz crowdfunding campaigns.

Assign layout, text hierarchy, and motion to each content block to maximize visual impact.

TONE: ${toneId}
UPLOADED_IMAGES: ${uploadedImageCount}

BLOCKS:
${JSON.stringify(compactBlocks, null, 2)}

LAYOUT RULES:
- "full-wide": image fills full width, text overlay — hero opener, key reveals (requires hasImage)
- "split": text + image side by side — feature explanation with photo (requires hasImage)
- "stack": text top + image bottom — story with visual evidence (requires hasImage)
- "text-only": no image — stats, declarations, numbered features, testimonials
- "card-grid": 2-3 column grid — parallel feature lists, pros/cons
- "image-full": image dominant, minimal text — lifestyle/atmosphere visuals (requires hasImage)

PATTERN RULES (critical for quality):
- startsWithNum=true → layout="text-only", textHierarchy="headline"
- hasStat=true with 1-3 lines → layout="text-only", textHierarchy="headline"
- lineCount >= 5 with no image → consider "card-grid" if items are parallel

TEXT_HIERARCHY:
- "headline": hooks, product name, big stats, numbered feature titles (01/02 etc.)
- "subhead": key benefits, section sub-titles, feature names after number
- "body": descriptions, feature details, explanations
- "caption": fine print, footnotes, specs, small text

MOTION RULES (apply to 30-40% of sections, ONLY headline/subhead):
- "underline-draw" | "marker-highlight" | "soft-scale" | "gradient-fill" | "box-blink" | null

CONSTRAINTS:
- hasImage=false → layout MUST be "text-only" or "card-grid"
- hasImage=true → layout MUST be "full-wide" | "split" | "stack" | "image-full"
- hasImage=true and lineCount=0 → "image-full" or "full-wide"
- First block → "full-wide" or "stack" for maximum impact
- Vary layouts — avoid repeating the same layout 3+ times in a row

Return ONLY a compact JSON array, no markdown:
[{"id":"s0","layout":"full-wide","textHierarchy":"headline","motionTemplate":"underline-draw"},{"id":"s1","layout":"text-only","textHierarchy":"headline","motionTemplate":null},...]

For "split" add "splitDirection":"text-left"|"text-right".
For "card-grid" add "cardCount":2|3.`;

  try {
    // 블록 수에 비례해 출력 토큰 한도를 잡는다 (블록당 결정 JSON ≈ 25~30 토큰).
    // 고정값 2048이었을 때 블록이 많은 콘티(예: 144개)에서는 응답이 중간에
    // 잘려(stop_reason: "max_tokens") 배열 파싱이 실패하고, 그 결과 모든
    // 섹션이 parseContiBlocks의 기본값(layout: "text-only")으로 대체되어
    // 레이아웃이 단조로워지고 업로드한 이미지도 전혀 표시되지 않았다.
    const maxTokens = Math.min(8192, Math.max(2048, blocks.length * 50));

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return blocks;

    const decisions: AILayoutDecision[] = JSON.parse(jsonMatch[0]);
    const decisionMap = new Map(decisions.map((d) => [d.id, d]));

    return blocks.map((block) => {
      const decision = decisionMap.get(block.id);
      let layout = decision?.layout ?? block.layout;
      let splitDirection = decision?.splitDirection;

      // AI가 이미지 슬롯이 있는 블록에 "text-only"/"card-grid"(이미지 미표시)
      // 레이아웃을 배정하면 업로드한 이미지가 결과물에 전혀 나타나지 않는다.
      // 프롬프트로 강제해도 LLM이 가끔 어겨서, 코드 단에서 한 번 더 교정한다.
      if (block.imageSlotIndex !== null && (layout === "text-only" || layout === "card-grid")) {
        layout = block.textLines.length > 0 ? "stack" : "image-full";
        splitDirection = undefined;
      }

      if (!decision) return { ...block, layout };
      return {
        ...block,
        layout,
        textHierarchy: decision.textHierarchy ?? block.textHierarchy,
        ...(decision.lineHierarchies ? { lineHierarchies: decision.lineHierarchies } : {}),
        ...(decision.textColorOverride ? { textColorOverride: decision.textColorOverride } : {}),
        motionTemplate: decision.motionTemplate ?? null,
        ...(splitDirection ? { splitDirection } : {}),
        ...(decision.cardCount ? { cardCount: decision.cardCount } : {}),
      };
    });
  } catch (err) {
    console.error("AI layout generation failed, using heuristics:", err);
    return applyHeuristicLayout(blocks, uploadedImageCount);
  }
}

// AI 실패 시 규칙 기반으로 레이아웃/위계/모션을 결정한다
function applyHeuristicLayout(
  blocks: DesignSection[],
  uploadedImageCount: number
): DesignSection[] {
  const FEATURE_NUM_RE = /^(0[1-9]|[1-9][0-9]?)\.?$/;
  const STAT_RE = /^[\d,\.][\d,\.\s]*[억만천원개명%회년배+·~]*\+?$/u;
  const motions: MotionTemplateType[] = [
    "underline-draw", "marker-highlight", "soft-scale", "gradient-fill", "box-blink",
  ];
  let motionIdx = 0;
  let imageLayoutIdx = 0;
  const imageLayouts: LayoutType[] = ["full-wide", "stack", "split", "full-wide", "stack"];

  return blocks.map((block, i) => {
    const firstLine = block.textLines[0]?.trim() ?? "";
    const hasImage = block.imageSlotIndex !== null;
    const startsWithNum = FEATURE_NUM_RE.test(firstLine);
    const hasStat = block.textLines.some((l) => STAT_RE.test(l.trim()));

    // 레이아웃 결정
    let layout: LayoutType;
    if (hasImage) {
      layout = imageLayouts[imageLayoutIdx++ % imageLayouts.length];
    } else if (startsWithNum || hasStat) {
      layout = "text-only";
    } else if (block.textLines.length >= 4 && i > 0) {
      layout = i % 5 === 0 ? "card-grid" : "text-only";
    } else {
      layout = "text-only";
    }

    // 위계 결정
    let textHierarchy: TextHierarchy;
    if (i === 0) {
      textHierarchy = "headline";
    } else if (startsWithNum || hasStat) {
      textHierarchy = "headline";
    } else if (i % 4 === 1) {
      textHierarchy = "subhead";
    } else if (i % 4 === 2) {
      textHierarchy = "headline";
    } else {
      textHierarchy = "body";
    }

    // lineHierarchies: 숫자 피처 블록은 첫 줄 headline + 나머지 subhead/body
    let lineHierarchies: TextHierarchy[] | undefined;
    if (startsWithNum && block.textLines.length > 1) {
      lineHierarchies = block.textLines.map((_, j) => {
        if (j === 0) return "headline";
        if (j === 1) return "subhead";
        return "body";
      });
    }

    // 모션: headline/subhead의 40%에만 적용
    let motionTemplate: MotionTemplateType = null;
    if ((textHierarchy === "headline" || textHierarchy === "subhead") && motionIdx % 3 !== 2) {
      motionTemplate = motions[motionIdx % motions.length];
    }
    if (textHierarchy === "headline" || textHierarchy === "subhead") motionIdx++;

    return {
      ...block,
      layout,
      textHierarchy,
      ...(lineHierarchies ? { lineHierarchies } : {}),
      motionTemplate,
      ...(layout === "card-grid" ? { cardCount: 2 as const } : {}),
      ...(layout === "split" ? { splitDirection: "text-left" as const } : {}),
    };
  });
}

// ─── AI 섹션 부분 수정 ──────────────────────────────────────────────────────
// 사용자의 자연어 수정 요청을 받아 단일 섹션의 카피/레이아웃을 부분 수정한다.
// 전체 재생성과 달리, 지시한 부분만 바꾸고 나머지는 그대로 유지하도록 안내한다.
export async function editDesignSection(
  section: DesignSection,
  instruction: string,
  toneId: string
): Promise<DesignSection> {
  const hasImage = section.imageSlotIndex !== null;

  const prompt = `You are a Korean e-commerce page design editor.

Apply the user's edit request to this single page section. You may change copy text (textLines), layout, textHierarchy, motionTemplate, splitDirection, cardCount — but ONLY what the request asks for. Keep everything else the same.

TONE: ${toneId}
HAS_IMAGE: ${hasImage}

CURRENT SECTION:
${JSON.stringify({
  textLines: section.textLines,
  layout: section.layout,
  textHierarchy: section.textHierarchy,
  lineHierarchies: section.lineHierarchies,
  textColorOverride: section.textColorOverride,
  motionTemplate: section.motionTemplate,
  splitDirection: section.splitDirection,
  cardCount: section.cardCount,
})}

USER REQUEST: "${instruction}"

LAYOUT OPTIONS: "full-wide" | "split" | "stack" | "text-only" | "card-grid" | "image-full"
- If HAS_IMAGE is false → layout MUST be "text-only" or "card-grid"
- If HAS_IMAGE is true → layout MUST be "full-wide", "split", "stack", or "image-full"

TEXT_HIERARCHY: "headline" | "subhead" | "body" | "caption"
- textHierarchy: applies to ALL lines (default)
- lineHierarchies: optional array, one entry per textLine — overrides textHierarchy per line. Include ONLY if the user requests different sizes per line (e.g. "첫 줄은 headline, 둘째 줄은 caption"). Length must match textLines.
- caption = smallest size, for fine print, footnotes, sub-explanations

TEXT_COLOR_OVERRIDE: optional hex string (e.g. "#FF0000"). Include ONLY if the user explicitly requests a color change. Omit if no color change requested.

MOTION_TEMPLATE: "underline-draw" | "marker-highlight" | "soft-scale" | "gradient-fill" | "box-blink" | null
For "split" add "splitDirection":"text-left"|"text-right". For "card-grid" add "cardCount":2|3.

Use **bold** markdown around keywords that should stand out.

Return ONLY a JSON object, no markdown:
{"textLines":["..."],"layout":"...","textHierarchy":"...","lineHierarchies":["headline","body"],"textColorOverride":"#FF0000","motionTemplate":null,"splitDirection":"text-left","cardCount":2}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 수정 응답 파싱 실패");

  const result: Partial<AILayoutDecision> & { textLines?: string[] } = JSON.parse(jsonMatch[0]);

  let layout: LayoutType = result.layout ?? section.layout;
  const newTextLines = result.textLines && result.textLines.length > 0 ? result.textLines : section.textLines;
  const hasText = newTextLines.length > 0;
  // 이미지 슬롯 유무에 맞지 않는 레이아웃이 배정되면 이미지/텍스트가 누락되므로 교정
  if (hasImage && (layout === "text-only" || layout === "card-grid")) {
    layout = hasText ? "stack" : "image-full";
  } else if (!hasImage && (layout === "full-wide" || layout === "split" || layout === "stack" || layout === "image-full")) {
    layout = "text-only";
  }

  // lineHierarchies 길이가 새 textLines와 맞지 않으면 버린다
  const rawLineHierarchies = result.lineHierarchies;
  const lineHierarchies =
    rawLineHierarchies && rawLineHierarchies.length === newTextLines.length
      ? rawLineHierarchies
      : section.lineHierarchies;

  const updatedSplit = layout === "split" ? (result.splitDirection ?? section.splitDirection ?? "text-left") : undefined;
  const updatedCard = layout === "card-grid" ? (result.cardCount ?? section.cardCount ?? 2) : undefined;
  const updatedColor = result.textColorOverride !== undefined ? result.textColorOverride : section.textColorOverride;

  return {
    ...section,
    textLines: newTextLines,
    layout,
    textHierarchy: result.textHierarchy ?? section.textHierarchy,
    ...(lineHierarchies ? { lineHierarchies } : {}),
    ...(updatedColor ? { textColorOverride: updatedColor } : {}),
    motionTemplate: result.motionTemplate ?? section.motionTemplate,
    ...(updatedSplit ? { splitDirection: updatedSplit } : {}),
    ...(updatedCard ? { cardCount: updatedCard } : {}),
  };
}
