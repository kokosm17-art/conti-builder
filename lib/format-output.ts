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

  const serializeCoreCopies = (c: CoreCopyCandidate[]) => c.map((x) => `${x.label}:${x.text}`).join("\n");
  if (
    o.projectTitles.join("\n") !== n.projectTitles.join("\n") ||
    o.coreCopy !== n.coreCopy ||
    serializeCoreCopies(o.coreCopies) !== serializeCoreCopies(n.coreCopies)
  ) {
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
export interface CoreCopyCandidate {
  label: string;
  text: string;
}

// "**핵심 카피 1 (감성 공감형):** 문구" 형식 (2026-08~ 신규 포맷, 후보 3개).
const CORE_COPY_CANDIDATE_RE = /^\*\*핵심\s*카피\s*(\d)\s*(?:\(([^)]*)\))?\s*:\*\*\s*(.*)$/;

export interface RecommendedName {
  name: string;
  reason: string;
}

export function parseSections(rawText: string) {
  const projectTitles: string[] = [];
  let coreCopy = "";
  const coreCopySlots: (CoreCopyCandidate | undefined)[] = [];
  const recommendedNames: RecommendedName[] = [];
  let collectingNames = false;
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

  // "기획 의도" 헤더는 항상 자기 줄 하나만 차지한다고 가정할 수 없다 — AI가
  // 가끔 "> 도입부 기획 의도: (설명 문장...)"처럼 헤더와 실제 내용을 콜론 뒤에
  // 한 줄로 붙여서 쓴다. 헤더 앞의 장식 기호(>, #, *, _)만 떼어내고 접두어를
  // 매칭해서, 뒤에 남은 내용이 있으면 그 구간의 첫 줄로 그대로 살려 쓴다.
  const matchIntentHeader = (line: string, prefix: string): string | null => {
    const withoutDeco = line.replace(/^[#*_>\-\s]+/, "");
    const re = new RegExp(`^${prefix}\\s*기획\\s*의도\\s*[:：]?\\s*(.*)$`);
    const m = withoutDeco.match(re);
    return m ? m[1].trim() : null;
  };

  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();

    // 마크다운 문법(>, #, *, _, -)과 공백을 모두 제거한 상태로 비교
    const clean = trimmed.replace(/[#*_\s>\-]/g, "");

    // 섹션 헤더 판별을 제목 후보 수집보다 먼저 검사해야 한다.
    const introIntentRest = matchIntentHeader(trimmed, "도입부");
    if (introIntentRest !== null) {
      currentSection = "intro"; currentType = "intent";
      if (introIntentRest) sections.intro.intent.push(introIntentRest);
      continue;
    }
    const mainIntentRest = matchIntentHeader(trimmed, "본론부");
    if (mainIntentRest !== null) {
      currentSection = "main"; currentType = "intent";
      if (mainIntentRest) sections.main.intent.push(mainIntentRest);
      continue;
    }
    const conclusionIntentRest = matchIntentHeader(trimmed, "결론부");
    if (conclusionIntentRest !== null) {
      currentSection = "conclusion"; currentType = "intent";
      if (conclusionIntentRest) sections.conclusion.intent.push(conclusionIntentRest);
      continue;
    }

    if (isHeaderCandidate(clean, "도입부콘티") || isHeaderCandidate(clean, "도입부본문") || (isHeaderCandidate(clean, "도입부") && !clean.includes("의도"))) { currentSection = "intro"; currentType = "content"; continue; }
    if (isHeaderCandidate(clean, "본론부콘티") || isHeaderCandidate(clean, "본론부본문") || (isHeaderCandidate(clean, "본론부") && !clean.includes("의도"))) { currentSection = "main"; currentType = "content"; continue; }
    if (isHeaderCandidate(clean, "결론부콘티") || isHeaderCandidate(clean, "결론부본문") || (isHeaderCandidate(clean, "결론부") && !clean.includes("의도"))) { currentSection = "conclusion"; currentType = "content"; continue; }

    // "AI 추천 제품명" 특별 요청 블록: "[AI 추천 제품명]" 줄 다음에 오는
    // "1. 이름: 이유" 형식의 줄들을 구분선(---)을 만날 때까지 수집한다.
    if (/^\[?\s*AI\s*추천\s*제품명\s*\]?$/.test(trimmed)) { collectingNames = true; continue; }
    if (collectingNames) {
      if (trimmed === "") continue;
      const nameMatch = trimmed.match(/^\d+[.)]\s*(.+?)\s*[:：]\s*(.*)$/);
      if (nameMatch) {
        recommendedNames.push({ name: nameMatch[1].trim(), reason: nameMatch[2].trim() });
        continue;
      }
    }

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
    const coreCopyMatch = !currentSection ? trimmed.match(CORE_COPY_CANDIDATE_RE) : null;
    if (coreCopyMatch) {
      const idx = parseInt(coreCopyMatch[1], 10) - 1;
      coreCopySlots[idx] = { label: (coreCopyMatch[2] || "").trim(), text: coreCopyMatch[3].trim() };
      continue;
    }
    if (trimmed === "---") {
      hasSeenSeparator = true;
      collectingNames = false;
      // 기획 의도를 수집하는 도중에 구분선(---)을 만나면 자동으로 콘티 본문 수집 상태로 전환
      if (currentSection && currentType === "intent") {
        currentType = "content";
      }
      continue;
    }

    // AI가 지침을 놓치고 제목·핵심카피 블록을 본문 중간에 다시 한번 쓰는
    // 경우가 있다. 섹션이 이미 시작된 뒤에 나타나는 "## " 헤딩이나
    // "**핵심 카피:**" 줄은 정상적인 본문에 나올 수 없는 형태이므로 무시한다.
    if (currentSection && (trimmed.startsWith("## ") || trimmed.startsWith("**핵심 카피:**") || CORE_COPY_CANDIDATE_RE.test(trimmed))) {
      continue;
    }

    // 기획 의도는 항상 ">"로 시작하는 줄들의 연속이다. 구분선(---)이 없거나
    // 엉뚱한 자리에 있어도 항상 정확하게 판단할 수 있도록, ">"로 시작하지
    // 않는 첫 줄(빈 줄 제외)이 나오는 순간을 "기획 의도 끝, 실제 카피 시작"의
    // 주된 판단 기준으로 삼는다. 위의 "---" 처리는 보조 안전장치로 유지한다.
    if (currentSection && currentType === "intent" && trimmed !== "" && !trimmed.startsWith(">")) {
      currentType = "content";
    }

    if (currentSection && currentType) {
      // 기획 의도 줄은 원문에 인용 기호(">")가 그대로 붙어 저장되어 있어서,
      // 화면에서 컴포넌트가 별도로 인용 표시를 더하면 ">"가 두 번 겹쳐 보인다.
      // 저장 시점에 인용 기호 자체는 제거하고 실제 문장만 남긴다.
      const storedLine = currentType === "intent" ? line.replace(/^\s*>\s?/, "") : line;
      sections[currentSection][currentType].push(storedLine);
    }
  }

  // AI가 검증 과정을 출력에 남기며 같은 제목(또는 수정본)을 두 번 이상 쓰는
  // 경우에 대비해, 중복 제목은 화면에 표시되기 전에 제거한다.
  // 또한 AI가 지침의 자리표시자 라벨("제목 후보 1" 등)을 실제 제목인 것처럼
  // 그대로 출력하는 경우에 대비해, 그런 라벨 형태의 문구도 걸러낸다.
  const PLACEHOLDER_LABEL_RE = /^제목\s*(후보)?\s*\d+$/;
  const dedupedTitles = [...new Set(projectTitles)].filter((t) => !PLACEHOLDER_LABEL_RE.test(t));

  const coreCopies = coreCopySlots.filter((c): c is CoreCopyCandidate => !!c);

  return {
    projectTitles: dedupedTitles,
    coreCopy,
    coreCopies,
    recommendedNames,
    intro: { intent: sections.intro.intent.join("\n").trim(), content: sections.intro.content.join("\n").trim() },
    main: { intent: sections.main.intent.join("\n").trim(), content: sections.main.content.join("\n").trim() },
    conclusion: { intent: sections.conclusion.intent.join("\n").trim(), content: sections.conclusion.content.join("\n").trim() },
  };
}
