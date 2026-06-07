"use client";

import { useEffect, useRef } from "react";
import { MotionTemplateType } from "@/lib/types";

interface MotionTextProps {
  text: string;
  motionTemplate: MotionTemplateType;
  accentColor: string;
  active: boolean;
  className?: string;
}

export function MotionText({ text, motionTemplate, accentColor, active, className = "" }: MotionTextProps) {
  if (!motionTemplate || !active) {
    return <span className={className}>{text}</span>;
  }

  switch (motionTemplate) {
    case "underline-draw":
      return <UnderlineDraw text={text} accentColor={accentColor} active={active} className={className} />;
    case "marker-highlight":
      return <MarkerHighlight text={text} accentColor={accentColor} active={active} className={className} />;
    case "soft-scale":
      return <SoftScale text={text} active={active} className={className} />;
    case "gradient-fill":
      return <GradientFill text={text} accentColor={accentColor} active={active} className={className} />;
    case "box-blink":
      return <BoxBlink text={text} accentColor={accentColor} active={active} className={className} />;
    default:
      return <span className={className}>{text}</span>;
  }
}

// ── 1. 밑줄 드로잉 ──────────────────────────────────────────────────────────
function UnderlineDraw({ text, accentColor, active, className }: Omit<MotionTextProps, "motionTemplate">) {
  return (
    <span className={`relative inline-block ${className}`}>
      {text}
      <span
        className="absolute left-0 bottom-[-2px] h-[3px] block transition-all duration-700 ease-out"
        style={{
          backgroundColor: accentColor,
          width: active ? "100%" : "0%",
        }}
      />
    </span>
  );
}

// ── 2. 형광펜 하이라이트 ────────────────────────────────────────────────────
function MarkerHighlight({ text, accentColor, active, className }: Omit<MotionTextProps, "motionTemplate">) {
  return (
    <span
      className={`relative inline-block px-1 ${className}`}
      style={{
        background: active
          ? `linear-gradient(to right, ${accentColor}33 0%, ${accentColor}33 100%)`
          : "transparent",
        transition: "background 0.8s ease-out",
      }}
    >
      {text}
    </span>
  );
}

// ── 3. 굵기 피드백 ──────────────────────────────────────────────────────────
function SoftScale({ text, active, className }: Omit<MotionTextProps, "motionTemplate" | "accentColor">) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        transform: active ? "scale(1.04)" : "scale(1)",
        fontWeight: active ? 700 : undefined,
        transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1), font-weight 0.5s ease",
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
}

// ── 4. 컬러 그라디언트 물들기 ───────────────────────────────────────────────
function GradientFill({ text, accentColor, active, className }: Omit<MotionTextProps, "motionTemplate">) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: active
          ? `linear-gradient(to right, ${accentColor}, ${accentColor}cc)`
          : "none",
        WebkitBackgroundClip: active ? "text" : undefined,
        WebkitTextFillColor: active ? "transparent" : undefined,
        backgroundClip: active ? "text" : undefined,
        transition: "all 0.8s ease-out",
      }}
    >
      {text}
    </span>
  );
}

// ── 5. 박스 배경 깜빡이 ─────────────────────────────────────────────────────
function BoxBlink({ text, accentColor, active, className }: Omit<MotionTextProps, "motionTemplate">) {
  const boxRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !boxRef.current) return;
    const el = boxRef.current;
    el.style.animation = "none";
    void el.offsetHeight; // reflow
    el.style.animation = "softBlink 1s ease-in-out 2";
  }, [active]);

  return (
    <span className={`relative inline-block px-2 py-0.5 ${className}`}>
      <span
        ref={boxRef}
        className="absolute inset-0 rounded"
        style={{
          backgroundColor: accentColor,
          opacity: active ? 0.15 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
      <span className="relative">{text}</span>

      <style>{`
        @keyframes softBlink {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </span>
  );
}
