"use client";

import { ToneConfig } from "@/components/design-system/tones";
import { DesignSection } from "@/lib/types";
import { MotionText } from "./motion";

export interface SectionProps {
  section: DesignSection;
  tone: ToneConfig;
  fontFamily: string;
  imageUrl: string | null;
  motionEnabled: boolean;
  replayKey?: number;
  infinite?: boolean;
}

const EMPTY_SLOT_STYLE = "border-2 border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 text-base";
const IMAGE_TEXT_SHADOW = "0 2px 20px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.35)";

// "01", "02" 등 넘버 피처 첫 줄 감지
const FEATURE_NUM_RE = /^(0[1-9]|[1-9][0-9]?)\.?$/;
// "400억", "99.9%", "37만대+" 등 수치 callout 감지
const STAT_CALLOUT_RE = /^[\d,\.][\d,\.\s]*[억만천원개명%회년배+·~]*\+?$/u;

// 톤별 이미지 오버레이 그라디언트 클래스 반환
function getOverlayClass(toneId: string): string {
  if (toneId === "cinematic") return "bg-gradient-to-t from-black/95 via-black/55 to-black/20";
  if (toneId === "premium") return "bg-gradient-to-t from-black/70 via-black/15 to-transparent";
  if (toneId === "impact") return "bg-gradient-to-br from-black/85 via-black/30 to-transparent";
  return "bg-gradient-to-t from-black/80 via-black/25 to-transparent";
}

// text-only 섹션에서 headline/subhead일 때만 렌더링되는 톤별 장식 요소
function TextAccentBar({ tone, hierarchy }: { tone: ToneConfig; hierarchy: DesignSection["textHierarchy"] }) {
  if (hierarchy !== "headline" && hierarchy !== "subhead") return null;

  if (tone.id === "cinematic") {
    // 다크 배경이 이미 충분히 무게감을 주므로 추가 장식 불필요
    return null;
  }

  if (tone.id === "impact") {
    // 굵은 두 줄 accent bar — 강렬한 포인트
    return (
      <div className="flex flex-col items-center gap-[3px] mb-5">
        <div className="h-[3px] w-10" style={{ backgroundColor: tone.accentColor }} />
        <div className="h-[3px] w-4 opacity-40" style={{ backgroundColor: tone.accentColor }} />
      </div>
    );
  }

  if (tone.id === "premium") {
    // 가는 상단 구분선 — 절제된 고급감
    return (
      <div
        className="border-t opacity-25 max-w-[60px] mx-auto mb-6"
        style={{ borderColor: tone.accentColor }}
      />
    );
  }

  // emotional / minimal — 짧은 accent bar
  return (
    <div className="flex justify-center mb-4">
      <div className="h-[3px] w-8 opacity-70" style={{ backgroundColor: tone.accentColor }} />
    </div>
  );
}

// compact = 좌우 분할처럼 폭이 좁은 영역에 들어가는 텍스트용 축소 사이즈
function getHeadingSize(hierarchy: DesignSection["textHierarchy"], compact = false) {
  if (hierarchy === "headline") {
    return compact
      ? "text-4xl sm:text-[45px] font-black leading-[1.25] tracking-tight"
      : "text-[54px] sm:text-[72px] font-black leading-[1.2] tracking-tight";
  }
  if (hierarchy === "subhead") {
    return compact
      ? "text-4xl sm:text-[40px] font-bold leading-tight"
      : "text-5xl sm:text-6xl font-bold leading-tight";
  }
  if (hierarchy === "body") {
    return compact
      ? "text-[28px] sm:text-[32px] leading-snug"
      : "text-4xl sm:text-[40px] leading-snug";
  }
  return compact
    ? "text-base sm:text-lg leading-normal opacity-80"
    : "text-xl sm:text-2xl leading-normal opacity-80";
}

// **bold** 마크다운을 accentColor 강조 글씨로 렌더링하고 ** 기호는 제거
function renderMarkdownText(text: string, accentColor: string) {
  const parts = text.split(/\*\*([\s\S]+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold" style={{ color: accentColor }}>
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function renderLines(
  section: DesignSection,
  tone: ToneConfig,
  motionEnabled: boolean,
  overrideClass = "",
  options: { compact?: boolean; shadow?: boolean; replayKey?: number; infinite?: boolean } = {}
) {
  const defaultSizeClass = getHeadingSize(section.textHierarchy, options.compact);
  const textColor = section.textColorOverride ?? tone.textColor;
  return section.textLines.map((line, i) => {
    const isFirstLine = i === 0;
    const lineHierarchy = section.lineHierarchies?.[i];
    const effectiveHierarchy = lineHierarchy ?? section.textHierarchy;
    const sizeClass = lineHierarchy
      ? getHeadingSize(lineHierarchy, options.compact)
      : defaultSizeClass;
    const content = renderMarkdownText(line, tone.accentColor);
    const gapClass = i > 0 ? (effectiveHierarchy === "headline" ? "mt-2" : "mt-1") : "";

    // 첫 번째 줄 특수 렌더링: 넘버 피처 or 수치 callout
    if (isFirstLine) {
      if (FEATURE_NUM_RE.test(line.trim())) {
        // "01" 형식의 넘버 피처 — 큰 accent 번호
        return (
          <p
            key={i}
            className="font-black leading-none mb-2"
            style={{
              fontSize: "clamp(2.5rem,7vw,4rem)",
              color: tone.accentColor,
              opacity: 0.85,
              ...(options.shadow ? { textShadow: IMAGE_TEXT_SHADOW } : {}),
            }}
          >
            {line.trim()}
          </p>
        );
      }

      if (STAT_CALLOUT_RE.test(line.trim()) && section.textHierarchy === "headline") {
        // "400억", "99.9%" 등 수치 callout — 오버사이즈 stat
        return (
          <p
            key={i}
            className="font-black leading-none tracking-tight mb-2"
            style={{
              fontSize: "clamp(3rem,10vw,5.5rem)",
              color: tone.accentColor,
              ...(options.shadow ? { textShadow: IMAGE_TEXT_SHADOW } : {}),
            }}
          >
            {line.trim()}
          </p>
        );
      }
    }

    return (
      <p
        key={i}
        className={`${overrideClass || sizeClass} ${gapClass}`}
        style={{
          color: textColor,
          ...(options.shadow ? { textShadow: IMAGE_TEXT_SHADOW } : {}),
        }}
      >
        {isFirstLine && section.motionTemplate ? (
          <MotionText
            text={content}
            motionTemplate={section.motionTemplate}
            accentColor={tone.accentColor}
            active={motionEnabled}
            replayKey={options.replayKey}
            infinite={options.infinite}
          />
        ) : (
          content
        )}
      </p>
    );
  });
}

// aspectRatio: undefined = 부모 높이에 맞춤(object-cover), "original" = 자연 비율, 그 외 = CSS aspect-ratio
function SectionImage({
  imageUrl,
  aspectRatio,
  alt = "",
}: {
  imageUrl: string | null;
  aspectRatio?: string;
  alt?: string;
}) {
  if (aspectRatio === "original") {
    return imageUrl ? (
      <img src={imageUrl} alt={alt} className="w-full h-auto block" />
    ) : (
      <div className={`${EMPTY_SLOT_STYLE} w-full min-h-[200px]`}>이미지 슬롯</div>
    );
  }

  if (aspectRatio) {
    return (
      <div className="w-full" style={{ aspectRatio }}>
        {imageUrl ? (
          <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className={`${EMPTY_SLOT_STYLE} w-full h-full`}>이미지 슬롯</div>
        )}
      </div>
    );
  }

  return imageUrl ? (
    <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
  ) : (
    <div className={`${EMPTY_SLOT_STYLE} w-full h-full min-h-[200px]`}>이미지 슬롯</div>
  );
}

// ── 1. 풀와이드 ──────────────────────────────────────────────────────────────
export function FullWideSection({ section, tone, fontFamily, imageUrl, motionEnabled, replayKey, infinite }: SectionProps) {
  const ar = section.imageAspectRatio;
  const textColor = imageUrl ? "#FFFFFF" : tone.textColor;
  const overlayClass = getOverlayClass(tone.id);

  if (ar) {
    return (
      <div className="relative w-full overflow-hidden" style={{ fontFamily, backgroundColor: tone.background }}>
        <SectionImage imageUrl={imageUrl} aspectRatio={ar} />
        {imageUrl && (
          <div className={`absolute inset-0 ${overlayClass} pointer-events-none`} />
        )}
        <div className="absolute inset-0 flex flex-col justify-end px-8 pb-14 pt-12">
          <div className="max-w-md">
            {renderLines(section, { ...tone, textColor }, motionEnabled, "", { shadow: !!imageUrl, replayKey, infinite })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 460, fontFamily, backgroundColor: tone.background }}>
      <div className="absolute inset-0">
        <SectionImage imageUrl={imageUrl} />
        {imageUrl && (
          <div className={`absolute inset-0 ${overlayClass}`} />
        )}
      </div>
      <div className="relative z-10 flex flex-col justify-end h-full min-h-[460px] px-8 pb-14 pt-24">
        <div className="max-w-md">
          {renderLines(section, { ...tone, textColor }, motionEnabled, "", { shadow: !!imageUrl, replayKey, infinite })}
        </div>
      </div>
    </div>
  );
}

// ── 2. 좌우 분할 ──────────────────────────────────────────────────────────────
export function SplitSection({ section, tone, fontFamily, imageUrl, motionEnabled, replayKey, infinite }: SectionProps) {
  const ar = section.imageAspectRatio;
  const textLeft = section.splitDirection !== "text-right";

  const textBlock = (
    <div className="flex-1 flex flex-col justify-center px-8 py-12">
      {renderLines(section, tone, motionEnabled, "", { compact: true, replayKey, infinite })}
    </div>
  );

  if (ar) {
    const imageBlock = (
      <div style={{ width: "50%" }}>
        <SectionImage imageUrl={imageUrl} aspectRatio={ar} />
      </div>
    );
    return (
      <div className="flex w-full overflow-hidden items-start" style={{ fontFamily, backgroundColor: tone.background }}>
        {textLeft ? <>{textBlock}{imageBlock}</> : <>{imageBlock}{textBlock}</>}
      </div>
    );
  }

  const imageBlock = (
    <div className="flex-1 min-h-[320px]">
      <SectionImage imageUrl={imageUrl} />
    </div>
  );
  return (
    <div className="flex w-full overflow-hidden" style={{ fontFamily, backgroundColor: tone.background, minHeight: 320 }}>
      {textLeft ? <>{textBlock}{imageBlock}</> : <>{imageBlock}{textBlock}</>}
    </div>
  );
}

// ── 3. 상하 분할 ──────────────────────────────────────────────────────────────
export function StackSection({ section, tone, fontFamily, imageUrl, motionEnabled, replayKey, infinite }: SectionProps) {
  const ar = section.imageAspectRatio;
  return (
    <div className="w-full overflow-hidden" style={{ fontFamily, backgroundColor: tone.background }}>
      <div className="px-8 py-10">
        {renderLines(section, tone, motionEnabled, "", { replayKey, infinite })}
      </div>
      {/* 비율 지정 시 aspect-ratio로, 미지정 시 고정 높이 340px */}
      <div className="w-full" style={ar && ar !== "original" ? { aspectRatio: ar } : ar === "original" ? {} : { height: 340 }}>
        <SectionImage imageUrl={imageUrl} aspectRatio={ar} />
      </div>
    </div>
  );
}

// ── 4. 텍스트 전용 ────────────────────────────────────────────────────────────
export function TextOnlySection({ section, tone, fontFamily, motionEnabled, replayKey, infinite }: Omit<SectionProps, "imageUrl">) {
  // cinematic + headline 조합은 진한 검정 배경으로 무게감 강조
  const bgColor = tone.id === "cinematic" && section.textHierarchy === "headline"
    ? "#141414"
    : tone.background;

  return (
    <div className="w-full px-10 py-16 text-center" style={{ fontFamily, backgroundColor: bgColor }}>
      <div className="max-w-xl mx-auto">
        <TextAccentBar tone={tone} hierarchy={section.textHierarchy} />
        <div className="space-y-3">
          {renderLines(section, tone, motionEnabled, "", { replayKey, infinite })}
        </div>
      </div>
    </div>
  );
}

// ── 5. 카드형 ─────────────────────────────────────────────────────────────────
export function CardGridSection({ section, tone, fontFamily, imageUrl, motionEnabled, replayKey, infinite }: SectionProps) {
  const cols = section.cardCount === 3 ? "grid-cols-3" : "grid-cols-2";
  const count = section.cardCount ?? 2;
  const perCard = Math.ceil(section.textLines.length / count);
  const cards = Array.from({ length: count }, (_, i) =>
    section.textLines.slice(i * perCard, (i + 1) * perCard)
  );

  return (
    <div className="w-full px-6 py-12" style={{ fontFamily, backgroundColor: tone.background }}>
      <div className={`grid ${cols} gap-5`}>
        {cards.map((lines, i) => (
          <div
            key={i}
            className="rounded-2xl p-6 border shadow-sm"
            style={{
              borderColor: `${tone.accentColor}33`,
              backgroundColor: tone.background,
              // 상단 accent 보더로 카드 개성 강조
              borderTopColor: tone.accentColor,
              borderTopWidth: 3,
            }}
          >
            {/* 카드 번호 배지 */}
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: tone.accentColor, opacity: 0.7 }}>
              {String(i + 1).padStart(2, "0")}
            </p>
            {i === 0 && imageUrl && (
              <div className="w-full h-36 mb-4 rounded-xl overflow-hidden">
                <SectionImage imageUrl={imageUrl} aspectRatio={section.imageAspectRatio} />
              </div>
            )}
            {lines.map((line, j) => {
              const content = renderMarkdownText(line, tone.accentColor);
              return (
                <p
                  key={j}
                  className={`${j === 0 ? "font-extrabold text-lg sm:text-xl" : "text-sm sm:text-base mt-2 opacity-80 leading-relaxed"}`}
                  style={{ color: tone.textColor }}
                >
                  {j === 0 && section.motionTemplate ? (
                    <MotionText
                      text={content}
                      motionTemplate={section.motionTemplate}
                      accentColor={tone.accentColor}
                      active={motionEnabled}
                      replayKey={replayKey}
                      infinite={infinite}
                    />
                  ) : (
                    content
                  )}
                </p>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6. 이미지 전용 ────────────────────────────────────────────────────────────
export function ImageFullSection({ section, tone, fontFamily, imageUrl, motionEnabled, replayKey, infinite }: SectionProps) {
  const hasText = section.textLines.length > 0;
  const ar = section.imageAspectRatio;
  const textColor = imageUrl ? "#FFFFFF" : tone.textColor;
  const overlayClass = getOverlayClass(tone.id);

  if (ar) {
    return (
      <div className="relative w-full overflow-hidden" style={{ fontFamily, backgroundColor: tone.background }}>
        <SectionImage imageUrl={imageUrl} aspectRatio={ar} />
        {imageUrl && hasText && (
          <div className={`absolute inset-0 ${overlayClass} pointer-events-none`} />
        )}
        {hasText && (
          <div className="absolute inset-0 px-8 pt-12 flex flex-col justify-start">
            <div className="max-w-md">
              {renderLines(section, { ...tone, textColor }, motionEnabled, "", { shadow: !!imageUrl, replayKey, infinite })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 480, fontFamily, backgroundColor: tone.background }}>
      <div className="absolute inset-0">
        <SectionImage imageUrl={imageUrl} />
        {imageUrl && hasText && (
          <div className={`absolute inset-0 ${overlayClass}`} />
        )}
      </div>
      {hasText && (
        <div className="relative z-10 px-8 pt-12 max-w-md">
          {renderLines(section, { ...tone, textColor }, motionEnabled, "", { shadow: !!imageUrl, replayKey, infinite })}
        </div>
      )}
    </div>
  );
}
