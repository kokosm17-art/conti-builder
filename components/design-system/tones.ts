export interface ToneConfig {
  id: string;
  name: string;
  recommendItems: string;
  description: string;
  reference: string;
  background: string;
  textColor: string;
  accentColor: string;
  recommendedFont: string;
  mood: string;
  cardStyleClass: string;
}

export const TONES: ToneConfig[] = [
  {
    id: "emotional",
    name: "감성 톤",
    recommendItems: "테크 / 홈리빙 / 스포츠 / 아웃도어",
    description:
      "어두운 배경 사진 위 큼직한 흰색 폰트로 불편함(문제) → 해결 스토리를 강렬하게 전개. 심플하고 강한 첫인상, 제품의 실용성과 신뢰감을 빠르게 전달하고 싶은 제품에 적합",
    reference: "한일전기 이동식 에어컨 레퍼런스",
    background: "#FAF8F5",
    textColor: "#1A1A1A",
    accentColor: "#8C6239",
    recommendedFont: "Pretendard",
    mood: "여백이 부드럽고 차분한 스토리북 느낌",
    cardStyleClass: "bg-[#FAF8F5] border-amber-200 text-[#1A1A1A]",
  },
  {
    id: "cinematic",
    name: "씨네마틱 톤",
    recommendItems: "테크 / 홈리빙 / 스포츠",
    description:
      "애플 st 상세페이지 디자인. 블랙 배경에 흰색 폰트가 기본. 스포트라이트 조명과 컬러 그라디언트 키워드로 프리미엄 테크 무드 연출. 혁신적이고 세련된 이미지를 강조하고 싶은 제품에 적합",
    reference: "Hey2 AI 안경 레퍼런스",
    background: "#0A0A0A",
    textColor: "#FFFFFF",
    accentColor: "#a855f7",
    recommendedFont: "Noto Sans CJK KR",
    mood: "스포트라이트 오버레이 및 힙한 테크 감성",
    cardStyleClass: "bg-[#0A0A0A] border-purple-900 text-white",
  },
  {
    id: "impact",
    name: "임팩트 톤",
    recommendItems: "언더웨어 / 기능성 패션 / 뷰티",
    description:
      "밝고 따뜻한 크림-화이트 배경에 포인트 컬러(핑크·오렌지 등) 키워드 강조. 실생활 공감형 카피와 제품 클로즈업으로 구성. 감성적 공감과 기능성을 동시에 어필하고 싶은 제품에 적합",
    reference: "타밈 젤리브라 + fhui 선데이션",
    background: "#FFFFFF",
    textColor: "#111111",
    accentColor: "#FF4500",
    recommendedFont: "Gmarket Sans",
    mood: "형광 톤 컬러 태그, 굵고 볼드한 문장 중심",
    cardStyleClass: "bg-[#FFFFFF] border-orange-200 text-gray-900",
  },
  {
    id: "premium",
    name: "프리미엄 톤",
    recommendItems: "프리미엄 패션 / 프리미엄 홈리빙",
    description:
      "베이지-그레이지 배경에 세리프 계열 폰트와 넉넉한 여백 중심 구성. 텍스트보다 이미지 비중이 높고, 소재·품질·디테일 클로즈업으로 브랜드 헤리티지를 전달. 고가 제품의 가치를 조용하고 품위 있게 표현하고 싶은 제품에 적합",
    reference: "ALLRESET 명품 데님 레퍼런스",
    background: "#E8E0D8",
    textColor: "#1E1E1E",
    accentColor: "#2B4F8C",
    recommendedFont: "바른바탕체",
    mood: "극도의 고급스러운 여백, 클래식한 세리프",
    cardStyleClass: "bg-[#E8E0D8] border-yellow-700/20 text-[#1E1E1E]",
  },
  {
    id: "minimal",
    name: "미니멀 톤",
    recommendItems: "테크 / 리빙 / 패션",
    description:
      "순백 배경 + 자연광 연출로 제품을 인테리어 오브제처럼 표현. 텍스트는 최소화하고 제품 비주얼과 여백이 중심. 디자인 자체가 경쟁력인 제품, 라이프스타일 감성을 담고 싶은 제품에 적합",
    reference: "신일 무선 BLDC팬 레퍼런스",
    background: "#FFFFFF",
    textColor: "#444444",
    accentColor: "#222222",
    recommendedFont: "노토산스 KR",
    mood: "제품이 인테리어 오브제처럼 돋보이는 얇은 폰트",
    cardStyleClass: "bg-[#FFFFFF] border-gray-200 text-gray-700",
  },
];

export function getToneById(id: string): ToneConfig | undefined {
  return TONES.find((t) => t.id === id);
}
