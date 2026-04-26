/**
 * 생성된 콘티 텍스트를 12자 모바일 레이아웃으로 포맷팅
 */
export function formatForMobile(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // 빈 줄 유지
      if (!trimmed) return "";

      // 헤더 (#, ##, ###) → 그대로
      if (trimmed.startsWith("#")) return line;

      // 굵은 텍스트, 구분선 → 그대로
      if (trimmed.startsWith("**") || trimmed === "---") return line;

      // (촬영 가이드) 괄호 라인 → 그대로
      if (trimmed.startsWith("(") && trimmed.endsWith(")")) return line;

      // 리스트 항목 → 그대로
      if (/^[-*•]/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) return line;

      // 일반 카피 텍스트만 12자 기준 분리
      return splitByMobileWidth(trimmed);
    })
    .join("\n");
}

function splitByMobileWidth(text: string, maxChars = 12): string {
  if (text.length <= maxChars) return text;

  const result: string[] = [];
  let current = "";
  const words = text.split(" ");

  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length > maxChars && current.length > 0) {
      result.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) result.push(current);
  return result.join("\n");
}

/**
 * 마크다운 텍스트에서 섹션별 파싱
 */
export function parseSections(rawText: string) {
  let projectTitle = "";
  let coreCopy = "";
  let currentSection = "";
  let currentType = "";

  const sections: Record<string, Record<string, string[]>> = {
    intro: { intent: [], content: [] },
    main: { intent: [], content: [] },
    conclusion: { intent: [], content: [] },
  };

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ") && !projectTitle) {
      projectTitle = trimmed.replace(/^##\s+/, "");
      continue;
    }
    if (trimmed.startsWith("**핵심 카피:**")) {
      coreCopy = trimmed.replace("**핵심 카피:**", "").trim();
      continue;
    }
    if (trimmed.includes("도입부 기획 의도")) { currentSection = "intro"; currentType = "intent"; continue; }
    if (trimmed.includes("도입부 콘티")) { currentSection = "intro"; currentType = "content"; continue; }
    if (trimmed.includes("본론부 기획 의도")) { currentSection = "main"; currentType = "intent"; continue; }
    if (trimmed.includes("본론부 콘티")) { currentSection = "main"; currentType = "content"; continue; }
    if (trimmed.includes("결론부 기획 의도")) { currentSection = "conclusion"; currentType = "intent"; continue; }
    if (trimmed.includes("결론부 콘티")) { currentSection = "conclusion"; currentType = "content"; continue; }
    if (trimmed === "---") continue;

    if (currentSection && currentType) {
      sections[currentSection][currentType].push(line);
    }
  }

  return {
    projectTitle,
    coreCopy,
    intro: { intent: sections.intro.intent.join("\n").trim(), content: sections.intro.content.join("\n").trim() },
    main: { intent: sections.main.intent.join("\n").trim(), content: sections.main.content.join("\n").trim() },
    conclusion: { intent: sections.conclusion.intent.join("\n").trim(), content: sections.conclusion.content.join("\n").trim() },
  };
}
