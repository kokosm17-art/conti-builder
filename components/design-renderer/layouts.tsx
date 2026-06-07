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
}

const EMPTY_SLOT_STYLE = "border-2 border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 text-sm";

function SectionImage({ imageUrl, alt = "" }: { imageUrl: string | null; alt?: string }) {
  if (!imageUrl) {
    return (
      <div className={`${EMPTY_SLOT_STYLE} w-full h-full min-h-[200px]`}>
        이미지 슬롯
      </div>
    );
  }
  return <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />;
}

function getHeadingSize(hierarchy: DesignSection["textHierarchy"]) {
  if (hierarchy === "headline") return "text-2xl sm:text-3xl font-black leading-tight";
  if (hierarchy === "subhead") return "text-lg sm:text-xl font-bold leading-snug";
  return "text-base leading-relaxed";
}

function renderLines(
  section: DesignSection,
  tone: ToneConfig,
  motionEnabled: boolean,
  overrideClass = ""
) {
  const sizeClass = getHeadingSize(section.textHierarchy);
  return section.textLines.map((line, i) => {
    const isFirstLine = i === 0;
    return (
      <p
        key={i}
        className={`${overrideClass || sizeClass} ${i > 0 ? "mt-1" : ""}`}
        style={{ color: tone.textColor }}
      >
        {isFirstLine && section.motionTemplate ? (
          <MotionText
            text={line}
            motionTemplate={section.motionTemplate}
            accentColor={tone.accentColor}
            active={motionEnabled}
          />
        ) : (
          line
        )}
      </p>
    );
  });
}

// ── 1. 풀와이드 ──────────────────────────────────────────────────────────────
export function FullWideSection({ section, tone, fontFamily, imageUrl, motionEnabled }: SectionProps) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: 420, fontFamily, backgroundColor: tone.background }}
    >
      <div className="absolute inset-0">
        <SectionImage imageUrl={imageUrl} />
        {imageUrl && <div className="absolute inset-0 bg-black/40" />}
      </div>
      <div className="relative z-10 flex flex-col justify-end h-full min-h-[420px] px-8 pb-10 pt-16">
        <div className="max-w-sm">
          {renderLines(section, { ...tone, textColor: imageUrl ? "#FFFFFF" : tone.textColor }, motionEnabled)}
        </div>
      </div>
    </div>
  );
}

// ── 2. 좌우 분할 ──────────────────────────────────────────────────────────────
export function SplitSection({ section, tone, fontFamily, imageUrl, motionEnabled }: SectionProps) {
  const textLeft = section.splitDirection !== "text-right";
  const textBlock = (
    <div className="flex-1 flex flex-col justify-center px-8 py-10">
      {renderLines(section, tone, motionEnabled)}
    </div>
  );
  const imageBlock = (
    <div className="flex-1 min-h-[320px]">
      <SectionImage imageUrl={imageUrl} />
    </div>
  );
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ fontFamily, backgroundColor: tone.background, minHeight: 320 }}
    >
      {textLeft ? <>{textBlock}{imageBlock}</> : <>{imageBlock}{textBlock}</>}
    </div>
  );
}

// ── 3. 상하 분할 ──────────────────────────────────────────────────────────────
export function StackSection({ section, tone, fontFamily, imageUrl, motionEnabled }: SectionProps) {
  return (
    <div className="w-full overflow-hidden" style={{ fontFamily, backgroundColor: tone.background }}>
      <div className="px-8 py-8">
        {renderLines(section, tone, motionEnabled)}
      </div>
      <div className="w-full" style={{ height: 320 }}>
        <SectionImage imageUrl={imageUrl} />
      </div>
    </div>
  );
}

// ── 4. 텍스트 전용 ────────────────────────────────────────────────────────────
export function TextOnlySection({ section, tone, fontFamily, motionEnabled }: Omit<SectionProps, "imageUrl">) {
  return (
    <div
      className="w-full px-8 py-12 text-center"
      style={{ fontFamily, backgroundColor: tone.background }}
    >
      <div className="max-w-lg mx-auto space-y-2">
        {renderLines(section, tone, motionEnabled, "")}
      </div>
    </div>
  );
}

// ── 5. 카드형 ─────────────────────────────────────────────────────────────────
export function CardGridSection({ section, tone, fontFamily, imageUrl, motionEnabled }: SectionProps) {
  const cols = section.cardCount === 3 ? "grid-cols-3" : "grid-cols-2";
  // Split textLines into card chunks
  const count = section.cardCount ?? 2;
  const perCard = Math.ceil(section.textLines.length / count);
  const cards = Array.from({ length: count }, (_, i) =>
    section.textLines.slice(i * perCard, (i + 1) * perCard)
  );

  return (
    <div
      className="w-full px-6 py-10"
      style={{ fontFamily, backgroundColor: tone.background }}
    >
      <div className={`grid ${cols} gap-4`}>
        {cards.map((lines, i) => (
          <div
            key={i}
            className="rounded-xl p-5 border"
            style={{ borderColor: `${tone.accentColor}33`, backgroundColor: `${tone.background}` }}
          >
            {i === 0 && imageUrl && (
              <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                <SectionImage imageUrl={imageUrl} />
              </div>
            )}
            {lines.map((line, j) => (
              <p
                key={j}
                className={`${j === 0 ? "font-bold text-sm" : "text-xs mt-1 opacity-80"}`}
                style={{ color: tone.textColor }}
              >
                {j === 0 && section.motionTemplate ? (
                  <MotionText
                    text={line}
                    motionTemplate={section.motionTemplate}
                    accentColor={tone.accentColor}
                    active={motionEnabled}
                  />
                ) : (
                  line
                )}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6. 이미지 전용 ────────────────────────────────────────────────────────────
export function ImageFullSection({ section, tone, fontFamily, imageUrl, motionEnabled }: SectionProps) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: 480, fontFamily, backgroundColor: tone.background }}
    >
      <div className="absolute inset-0">
        <SectionImage imageUrl={imageUrl} />
      </div>
      {section.textLines.length > 0 && (
        <div className="absolute bottom-6 left-0 right-0 text-center z-10">
          {section.textLines.slice(0, 1).map((line, i) => (
            <p
              key={i}
              className="text-sm font-semibold px-4 py-1 inline-block rounded"
              style={{
                color: "#fff",
                backgroundColor: "rgba(0,0,0,0.45)",
              }}
            >
              {section.motionTemplate ? (
                <MotionText
                  text={line}
                  motionTemplate={section.motionTemplate}
                  accentColor={tone.accentColor}
                  active={motionEnabled}
                />
              ) : line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
