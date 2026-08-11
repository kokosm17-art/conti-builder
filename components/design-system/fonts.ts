export interface FontOption {
  id: string;
  label: string;
  cssFamily: string;
  previewClass: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "pretendard",
    label: "프리텐다드",
    cssFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
    previewClass: "font-pretendard",
  },
  {
    id: "noto-sans-cjk",
    label: "Noto Sans CJK KR",
    cssFamily: "'Noto Sans KR', sans-serif",
    previewClass: "font-noto-sans-kr",
  },
  {
    id: "gmarket",
    label: "Gmarket Sans",
    cssFamily: "'GmarketSans', 'Gmarket Sans', sans-serif",
    previewClass: "font-gmarket",
  },
  {
    id: "noto-kr",
    label: "노토산스 KR",
    cssFamily: "'Noto Sans KR', sans-serif",
    previewClass: "font-noto-sans-kr",
  },
  {
    id: "nanum",
    label: "나눔체",
    cssFamily: "'Nanum Gothic', sans-serif",
    previewClass: "font-nanum",
  },
  {
    id: "baemin-jua",
    label: "배달의민족 주아체",
    cssFamily: "'BMJUA', sans-serif",
    previewClass: "font-baemin",
  },
];

// 톤별 추천 폰트 매핑 (font id 기준)
export const TONE_RECOMMENDED_FONT: Record<string, string> = {
  emotional: "pretendard",
  cinematic: "noto-sans-cjk",
  impact: "gmarket",
  premium: "barungothic",
  minimal: "noto-kr",
  stimulus: "gmarket",
};

// 추천 폰트 CSS family 반환 (tone id + fontChoice 기준)
export function getAppliedFont(toneId: string, fontChoice: string): string {
  if (fontChoice && fontChoice !== "recommended") {
    const option = FONT_OPTIONS.find((f) => f.id === fontChoice);
    if (option) return option.cssFamily;
  }
  // 프리미엄 톤 추천 폰트는 바른바탕체 (별도 @font-face)
  if (toneId === "premium") {
    return "'BarunGothic', 'Nanum Myeongjo', Georgia, serif";
  }
  const recommendedId = TONE_RECOMMENDED_FONT[toneId];
  const option = FONT_OPTIONS.find((f) => f.id === recommendedId);
  return option?.cssFamily ?? "'Noto Sans KR', sans-serif";
}
