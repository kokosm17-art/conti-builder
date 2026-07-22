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

export interface SectionPatch {
  section: string;
  content: string;
}

const SECTION_HEADER_PATTERNS: Record<string, string> = {
  intro_intent: "도입부 기획 의도",
  intro_content: "도입부 콘티",
  main_intent: "본론부 기획 의도",
  main_content: "본론부 콘티",
  conclusion_intent: "결론부 기획 의도",
  conclusion_content: "결론부 콘티",
};

const ALL_SECTION_KEYWORDS = Object.values(SECTION_HEADER_PATTERNS);

export interface SectionChangeInfo {
  intent: boolean;
  content: boolean;
}

export function detectChangedSections(oldText: string, newText: string): Map<string, SectionChangeInfo> {
  const changed = new Map<string, SectionChangeInfo>();

  // 텍스트가 동일하면 변경 없음
  if (oldText === newText) return changed;

  const o = parseSections(oldText);
  const n = parseSections(newText);

  // 파싱 성공 여부 확인 (섹션 내용이 있어야 파싱 성공으로 간주)
  const oldOk = !!(o.intro.content || o.main.content || o.conclusion.content);
  const newOk = !!(n.intro.content || n.main.content || n.conclusion.content);

  // 파싱 실패 시 모든 섹션을 변경됨으로 표시
  if (!oldOk || !newOk) {
    changed.set("intro", { intent: true, content: true });
    changed.set("main", { intent: true, content: true });
    changed.set("conclusion", { intent: true, content: true });
    return changed;
  }

  if (o.projectTitles.join("\n") !== n.projectTitles.join("\n") || o.coreCopy !== n.coreCopy) {
    changed.set("title", { intent: false, content: true });
  }
  if (o.intro.intent !== n.intro.intent || o.intro.content !== n.intro.content) {
    changed.set("intro", {
      intent: o.intro.intent !== n.intro.intent,
      content: o.intro.content !== n.intro.content,
    });
  }
  if (o.main.intent !== n.main.intent || o.main.content !== n.main.content) {
    changed.set("main", {
      intent: o.main.intent !== n.main.intent,
      content: o.main.content !== n.main.content,
    });
  }
  if (o.conclusion.intent !== n.conclusion.intent || o.conclusion.content !== n.conclusion.content) {
    changed.set("conclusion", {
      intent: o.conclusion.intent !== n.conclusion.intent,
      content: o.conclusion.content !== n.conclusion.content,
    });
  }

  // 파싱은 됐지만 변경 감지 없으면 안전하게 모두 표시
  if (changed.size === 0) {
    changed.set("intro", { intent: true, content: true });
    changed.set("main", { intent: true, content: true });
    changed.set("conclusion", { intent: true, content: true });
  }

  return changed;
}

export function parsePatchResponse(patchText: string): SectionPatch[] {
  const patches: SectionPatch[] = [];
  const regex = />>>SECTION:(\w+)<<<([\s\S]*?)>>>END_SECTION<<</g;
  let match;
  while ((match = regex.exec(patchText)) !== null) {
    const content = match[2].trim();
    if (content) patches.push({ section: match[1].trim(), content });
  }
  return patches;
}

export function applySectionPatches(rawText: string, patches: SectionPatch[]): string {
  let result = rawText;
  for (const patch of patches) {
    result = applyOnePatch(result, patch);
  }
  return result;
}

function applyOnePatch(rawText: string, patch: SectionPatch): string {
  if (patch.section === "title") {
    return rawText.replace(/^## .+/m, `## ${patch.content}`);
  }
  if (patch.section === "core_copy") {
    return rawText.replace(/\*\*핵심 카피:\*\*.*/, `**핵심 카피:** ${patch.content}`);
  }

  const headerPattern = SECTION_HEADER_PATTERNS[patch.section];
  if (!headerPattern) return rawText;

  const lines = rawText.split("\n");
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(headerPattern)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return rawText;

  let endIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isNextHeader = ALL_SECTION_KEYWORDS.some(
      (kw) => kw !== headerPattern && trimmed.includes(kw)
    );
    if (isNextHeader) {
      endIdx = i;
      while (endIdx > headerIdx + 1 && lines[endIdx - 1].trim() === "") {
        endIdx--;
      }
      break;
    }
  }

  return [
    ...lines.slice(0, headerIdx + 1),
    "",
    patch.content,
    "",
    ...lines.slice(endIdx),
  ].join("\n");
}

/**
 * 마크다운 텍스트에서 섹션별 파싱
 */
export function parseSections(rawText: string) {
  const projectTitles: string[] = [];
  let coreCopy = "";
  let currentSection = "";
  let currentType = "";
  let hasSeenSeparator = false;

  const sections: Record<string, Record<string, string[]>> = {
    intro: { intent: [], content: [] },
    main: { intent: [], content: [] },
    conclusion: { intent: [], content: [] },
  };

  const isHeaderCandidate = (clean: string, keyword: string) => {
    return clean.startsWith(keyword) && clean.length <= keyword.length + 5;
  };

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();

    // 마크다운 문법(>, #, *, _, -)과 공백을 모두 제거한 상태로 비교
    const clean = trimmed.replace(/[#*_\s>\-]/g, "");

    // 섹션 헤더 판별을 제목 후보 수집보다 먼저 검사해야 한다.
    if (isHeaderCandidate(clean, "도입부기획의도")) { currentSection = "intro"; currentType = "intent"; continue; }
    if (isHeaderCandidate(clean, "본론부기획의도")) { currentSection = "main"; currentType = "intent"; continue; }
    if (isHeaderCandidate(clean, "결론부기획의도")) { currentSection = "conclusion"; currentType = "intent"; continue; }

    if (isHeaderCandidate(clean, "도입부콘티") || isHeaderCandidate(clean, "도입부본문") || (isHeaderCandidate(clean, "도입부") && !clean.includes("의도"))) { currentSection = "intro"; currentType = "content"; continue; }
    if (isHeaderCandidate(clean, "본론부콘티") || isHeaderCandidate(clean, "본론부본문") || (isHeaderCandidate(clean, "본론부") && !clean.includes("의도"))) { currentSection = "main"; currentType = "content"; continue; }
    if (isHeaderCandidate(clean, "결론부콘티") || isHeaderCandidate(clean, "결론부본문") || (isHeaderCandidate(clean, "결론부") && !clean.includes("의도"))) { currentSection = "conclusion"; currentType = "content"; continue; }

    // 프로젝트 제목 후보 3개는 처음에 등장하는 "## " 헤딩만 수집한다.
    // 핵심 카피가 설정되었거나, 구분선(---)을 만난 적이 있거나, 이미 5개 이상 가져왔다면 수집하지 않는다.
    if (trimmed.startsWith("## ") && !currentSection && !coreCopy && !hasSeenSeparator && projectTitles.length < 5) {
      projectTitles.push(trimmed.replace(/^##\s+/, "").replace(/\*\*/g, "").trim());
      continue;
    }
    if (trimmed.startsWith("**핵심 카피:**")) {
      coreCopy = trimmed.replace("**핵심 카피:**", "").trim();
      continue;
    }
    if (trimmed === "---") {
      hasSeenSeparator = true;
      // 기획 의도를 수집하는 도중에 구분선(---)을 만나면 자동으로 콘티 본문 수집 상태로 전환
      if (currentSection && currentType === "intent") {
        currentType = "content";
      }
      continue;
    }

    // AI가 지침을 놓치고 제목·핵심카피 블록을 본문 중간에 다시 한번 쓰는
    // 경우가 있다. 섹션이 이미 시작된 뒤에 나타나는 "## " 헤딩이나
    // "**핵심 카피:**" 줄은 정상적인 본문에 나올 수 없는 형태이므로 무시한다.
    if (currentSection && (trimmed.startsWith("## ") || trimmed.startsWith("**핵심 카피:**"))) {
      continue;
    }

    if (currentSection && currentType) {
      sections[currentSection][currentType].push(line);
    }
  }

  // AI가 검증 과정을 출력에 남기며 같은 제목(또는 수정본)을 두 번 이상 쓰는
  // 경우에 대비해, 중복 제목은 화면에 표시되기 전에 제거한다.
  // 또한 AI가 지침의 자리표시자 라벨("제목 후보 1" 등)을 실제 제목인 것처럼
  // 그대로 출력하는 경우에 대비해, 그런 라벨 형태의 문구도 걸러낸다.
  const PLACEHOLDER_LABEL_RE = /^제목\s*(후보)?\s*\d+$/;
  const dedupedTitles = [...new Set(projectTitles)].filter((t) => !PLACEHOLDER_LABEL_RE.test(t));

  return {
    projectTitles: dedupedTitles,
    coreCopy,
    intro: { intent: sections.intro.intent.join("\n").trim(), content: sections.intro.content.join("\n").trim() },
    main: { intent: sections.main.intent.join("\n").trim(), content: sections.main.content.join("\n").trim() },
    conclusion: { intent: sections.conclusion.intent.join("\n").trim(), content: sections.conclusion.content.join("\n").trim() },
  };
}
