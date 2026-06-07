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

  const compactBlocks = blocks.map((b) => ({
    id: b.id,
    text: b.textLines.slice(0, 3).join(" ").substring(0, 80),
    hasImage: b.imageSlotIndex !== null,
    lineCount: b.textLines.length,
  }));

  const prompt = `You are a Korean e-commerce page layout designer.

Assign layout and motion to each block of a Korean product detail page.

TONE: ${toneId}
UPLOADED_IMAGES: ${uploadedImageCount}

BLOCKS:
${JSON.stringify(compactBlocks)}

LAYOUT RULES:
- "full-wide": image fills width, text overlay — opener, key reveal (requires hasImage)
- "split": text + image side by side — feature with supporting photo (requires hasImage)
- "stack": text above image or below — story with evidence (requires hasImage)
- "text-only": no image — stats, declarations, MUST use when hasImage=false
- "card-grid": 2-3 columns — parallel features list
- "image-full": image dominant, minimal text (requires hasImage)

MOTION RULES (apply to 30-40% of sections max):
- "underline-draw" | "marker-highlight" | "soft-scale" | "gradient-fill" | "box-blink" | null

TEXT_HIERARCHY: "headline" for hooks/product name, "subhead" for benefits, "body" for details

CONSTRAINTS:
- If hasImage=false → layout MUST be "text-only" or "card-grid"
- If hasImage=true → layout MUST be one of "full-wide", "split", "stack", "image-full" (never "text-only"/"card-grid" — the image would not be shown)
- If hasImage=true and lineCount=0 (image-only block) → prefer "image-full" or "full-wide"
- First block → "full-wide" or "stack" for impact
- Vary layouts to avoid repetition

Return ONLY a JSON array, no markdown:
[{"id":"s0","layout":"full-wide","textHierarchy":"headline","motionTemplate":"underline-draw"},...]

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
        motionTemplate: decision.motionTemplate ?? null,
        splitDirection,
        cardCount: decision.cardCount,
      };
    });
  } catch (err) {
    console.error("AI layout generation failed, using defaults:", err);
    return blocks;
  }
}
