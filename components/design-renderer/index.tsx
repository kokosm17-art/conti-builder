"use client";

import { DesignSection } from "@/lib/types";
import { ToneConfig, getToneById } from "@/components/design-system/tones";
import { getAppliedFont } from "@/components/design-system/fonts";
import {
  FullWideSection,
  SplitSection,
  StackSection,
  TextOnlySection,
  CardGridSection,
  ImageFullSection,
} from "./layouts";

interface DesignRendererProps {
  sections: DesignSection[];
  toneId: string;
  fontChoice: string;
  assets: Record<string, string>;
  motionEnabled?: boolean;
}

export function DesignRenderer({
  sections,
  toneId,
  fontChoice,
  assets,
  motionEnabled = true,
}: DesignRendererProps) {
  const tone: ToneConfig = getToneById(toneId) ?? {
    id: "minimal",
    name: "미니멀",
    recommendItems: "",
    description: "",
    reference: "",
    background: "#FFFFFF",
    textColor: "#444444",
    accentColor: "#222222",
    recommendedFont: "Noto Sans KR",
    mood: "",
    cardStyleClass: "",
  };

  const fontFamily = getAppliedFont(toneId, fontChoice);

  return (
    <div
      className="w-full max-w-[750px] mx-auto overflow-hidden"
      style={{ backgroundColor: tone.background, fontFamily }}
    >
      {sections.map((section) => {
        const imageUrl =
          section.imageSlotIndex !== null
            ? (assets[`placeholder_${section.imageSlotIndex}`] ?? null)
            : null;

        const commonProps = { section, tone, fontFamily, imageUrl, motionEnabled };

        switch (section.layout) {
          case "full-wide":
            return <FullWideSection key={section.id} {...commonProps} />;
          case "split":
            return <SplitSection key={section.id} {...commonProps} />;
          case "stack":
            return <StackSection key={section.id} {...commonProps} />;
          case "text-only":
            return <TextOnlySection key={section.id} {...commonProps} />;
          case "card-grid":
            return <CardGridSection key={section.id} {...commonProps} />;
          case "image-full":
            return <ImageFullSection key={section.id} {...commonProps} />;
          default:
            return <TextOnlySection key={section.id} {...commonProps} />;
        }
      })}
    </div>
  );
}
