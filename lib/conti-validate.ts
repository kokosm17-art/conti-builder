// ─── 콘티 이미지 슬롯 배치 규칙 자동 검증 + 자동 보정 ──────────────────────────
// 배경: 프롬프트 지침(system-prompt.ts D-6)만으로는 AI가 가끔 이미지 슬롯 규칙을
// 놓치는 실수를 완전히 막지 못한다(실사용 중 반복 발견). 그래서 생성 직후 코드가
// 정확하게(빈 줄 기준) 위반 여부를 확인하고, 위반이 있을 때만 AI에게 그 부분만
// 고쳐달라고 추가로 한 번 더 요청한다. 검사 항목:
//   1) 이미지 슬롯 없이 문장이 3개 이상 연속되면 안 된다(2문장 상한)
//   2) 한 Point가 끝나고 다음 "Point N+1. " 제목이 시작되기 직전에도 이미지 슬롯이 있어야 한다

import Anthropic from "@anthropic-ai/sdk";

const MAX_FIX_ATTEMPTS = 2;

// 빈 줄로 구분된 블록 단위로 나눠, 이미지 슬롯"(...)"이나 "I" 구분선이 아닌
// 순수 카피 블록이 3개 이상 연속되는 구간을 찾아낸다.
export function findSlotViolations(sectionText: string): string[] {
  if (!sectionText.trim()) return [];
  const blocks = sectionText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const violations: string[] = [];
  let run: string[] = [];
  for (const block of blocks) {
    const isImageSlot = /^\([\s\S]+\)$/.test(block);
    const isDivider = block === "I";
    if (isImageSlot || isDivider) {
      run = [];
      continue;
    }
    run.push(block);
    if (run.length === 3) {
      // 3개째에서 위반 확정 — 이후 같은 런이 더 길어져도 중복 보고하지 않는다.
      violations.push(run.join("\n\n"));
    }
  }
  return violations;
}

// main.content(본론부 본문)에서 "Point N. " 제목 바로 앞 블록이 이미지 슬롯이 아닌 경우를 찾는다.
// 첫 번째 Point는 대상이 아니다(그 앞은 도입부→본론부 전환이라 별개 규칙).
export function findPointTransitionViolations(mainContent: string): string[] {
  if (!mainContent.trim()) return [];
  const blocks = mainContent
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const isPointTitle = (b: string) => /^Point\s*\d+\s*\./.test(b);
  const isImageSlot = (b: string) => /^\([\s\S]+\)$/.test(b);

  const violations: string[] = [];
  let seenFirstPoint = false;
  for (let i = 0; i < blocks.length; i++) {
    if (!isPointTitle(blocks[i])) continue;
    if (!seenFirstPoint) { seenFirstPoint = true; continue; } // 첫 Point는 제외
    const prev = blocks[i - 1];
    if (!prev || !isImageSlot(prev)) {
      const context = [prev, blocks[i]].filter(Boolean).join("\n\n");
      violations.push(context);
    }
  }
  return violations;
}

async function requestFix(
  client: Anthropic,
  fullText: string,
  slotRunViolations: string[],
  pointTransitionViolations: string[]
): Promise<string> {
  const rules: string[] = [];
  if (slotRunViolations.length > 0) {
    rules.push(
      `- 이미지 슬롯(괄호) 또는 "I" 구분선 없이 문장이 3개 이상 연속되면 안 된다(최대 2문장까지 허용). 위반 구간에 적절한 이미지 슬롯 "(장면 설명)"을 새로 삽입하라.`
    );
  }
  if (pointTransitionViolations.length > 0) {
    rules.push(
      `- 한 Point의 설명이 끝나고 다음 "Point N+1. " 제목이 시작되기 바로 직전에도 이미지 슬롯이 있어야 한다. 없는 곳에는 그 Point를 마무리하는 느낌의 이미지 슬롯 "(장면 설명)"을 제목 바로 앞에 새로 삽입하라.`
    );
  }

  const systemText = `당신은 와디즈 상세페이지 콘티를 검수·보정하는 편집자입니다.
아래 콘티에서 다음 규칙을 어긴 구간이 있습니다:
${rules.join("\n")}
그 외의 모든 내용(기획 의도, 헤더, 핵심 카피, Point 제목 문구, FAQ, 배송 안내 등)은 단 한 글자도 바꾸지 말고 원문 그대로 유지하세요.
전체 콘티 텍스트를 처음부터 끝까지 다시 반환하세요. 마크다운 코드펜스나 설명 문구 없이 콘티 본문만 반환하세요.`;

  const violations = [
    ...slotRunViolations.map((v) => `[2문장 상한 위반]\n${v}`),
    ...pointTransitionViolations.map((v) => `[Point 전환 직전 슬롯 누락]\n${v}`),
  ];

  const userText = `전체 콘티:\n${fullText}\n\n위반된 것으로 확인된 구간(참고용, 텍스트가 정확히 일치하지 않을 수 있으니 전체를 다시 스캔해서 같은 종류의 위반을 모두 고치세요):\n${violations
    .join("\n\n")}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [{ type: "text", text: systemText }],
    messages: [{ role: "user", content: userText }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text.trim() : fullText;
}

// fullText에서 도입부/본론부 본문만 뽑아 위반을 검사하고, 있으면 AI에게 보정 요청.
// 결론부는 FAQ/배송안내처럼 이미지 슬롯이 애초에 필요 없는 boilerplate가 섞여 있어
// 이 자동 검증 대상에서 제외한다(오탐 방지).
export async function verifyAndFixContiSlots(
  client: Anthropic,
  fullText: string,
  parseSectionsFn: (raw: string) => { intro: { content: string }; main: { content: string } }
): Promise<string> {
  let current = fullText;

  for (let attempt = 0; attempt < MAX_FIX_ATTEMPTS; attempt++) {
    const parsed = parseSectionsFn(current);
    const slotRunViolations = [
      ...findSlotViolations(parsed.intro.content),
      ...findSlotViolations(parsed.main.content),
    ];
    const pointTransitionViolations = findPointTransitionViolations(parsed.main.content);
    if (slotRunViolations.length === 0 && pointTransitionViolations.length === 0) break;

    try {
      current = await requestFix(client, current, slotRunViolations, pointTransitionViolations);
    } catch {
      // 보정 호출 자체가 실패하면 지금까지의 결과를 그대로 사용(사용자 대기 시간 보호).
      break;
    }
  }

  return current;
}
