"use client";

import { useEffect, useRef } from "react";
import type { MotionTemplateType } from "@/lib/types";

interface MotionTextProps {
  children: React.ReactNode;
  template: MotionTemplateType;
  accentColor?: string;
  active?: boolean;
  className?: string;
}

export function MotionText({
  children,
  template,
  accentColor = "#8C6239",
  active = true,
  className = "",
}: MotionTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.setProperty("--accent-color", accentColor);
    ref.current.style.setProperty("--highlight-color", accentColor + "55");
    ref.current.style.setProperty("--gradient-color-start", accentColor);
    ref.current.style.setProperty("--gradient-color-end", accentColor + "aa");
    ref.current.style.setProperty("--text-color", "currentColor");
  }, [accentColor]);

  if (!template) {
    return <span className={className}>{children}</span>;
  }

  const motionClass = active ? `motion-${template} motion-active` : `motion-${template}`;

  return (
    <span ref={ref} className={`${motionClass} ${className}`}>
      {children}
    </span>
  );
}

// 템플릿 이름 → 한글 레이블
export const MOTION_LABELS: Record<NonNullable<MotionTemplateType>, string> = {
  "underline-draw": "밑줄 드로잉",
  "marker-highlight": "형광펜 하이라이트",
  "soft-scale": "굵기 피드백",
  "gradient-fill": "컬러 그라디언트",
  "box-blink": "박스 배경 깜빡이",
};
