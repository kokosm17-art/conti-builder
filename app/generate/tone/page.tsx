"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getActiveSession, updateDesignTone, updateFontChoice, incrementDesignGen } from "@/lib/session";
import { FONT_OPTIONS, TONE_RECOMMENDED_FONT } from "@/components/design-system/fonts";
import { ArrowLeft, Sparkles, AlertTriangle, Check } from "lucide-react";

interface ToneItem {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommend: string;
  styleClass: string;
  accentColor: string;
}

const TONE_LIST: ToneItem[] = [
  {
    id: "emotional",
    name: "감성 톤",
    badge: "테크 / 홈리빙 / 스포츠 / 아웃도어",
    description: "어두운 배경 사진 위 큼직한 흰색 폰트로 불편함(문제) ➔ 해결 스토리를 강렬하게 전개. 심플하고 강한 첫인상, 제품의 실용성과 신뢰감을 빠르게 전달하고 싶은 제품에 적합",
    recommend: "한일전기 이동식 에어컨 레퍼런스",
    styleClass: "bg-[#FAF8F5] border-amber-200 text-[#1A1A1A]",
    accentColor: "#8C6239",
  },
  {
    id: "cinematic",
    name: "씨네마틱 톤",
    badge: "테크 / 홈리빙 / 스포츠",
    description: "애플 st 상세페이지 디자인. 블랙 배경에 흰색 폰트가 기본. 스포트라이트 조명과 컬러 그라디언트 키워드로 프리미엄 테크 무드 연출. 혁신적이고 세련된 이미지를 강조하고 싶은 제품에 적합",
    recommend: "Hey2 AI 안경 레퍼런스",
    styleClass: "bg-[#0A0A0A] border-purple-900 text-white",
    accentColor: "#a855f7",
  },
  {
    id: "impact",
    name: "임팩트 톤",
    badge: "언더웨어 / 기능성 패션 / 뷰티",
    description: "밝고 따뜻한 크림-화이트 배경에 포인트 컬러(핑크·오렌지 등) 키워드 강조. 실생활 공감형 카피와 제품 클로즈업으로 구성. 감성적 공감과 기능성을 동시에 어필하고 싶은 제품에 적합",
    recommend: "타밈 젤리브라 + fhui 선데이션",
    styleClass: "bg-[#FFFFFF] border-orange-200 text-gray-900",
    accentColor: "#ff4500",
  },
  {
    id: "premium",
    name: "프리미엄 톤",
    badge: "프리미엄 패션 / 프리미엄 홈리빙",
    description: "베이지-그레이지 배경에 세리프 계열 폰트와 넉넉한 여백 중심 구성. 텍스트보다 이미지 비중이 높고, 소재·품질·디테일 클로즈업으로 브랜드 헤리티지를 전달. 고가 제품의 가치를 조용하고 품위 있게 표현하고 싶은 제품에 적합",
    recommend: "ALLRESET 명품 데님 레퍼런스",
    styleClass: "bg-[#E8E0D8] border-yellow-700/20 text-[#1E1E1E] font-serif",
    accentColor: "#2B4F8C",
  },
  {
    id: "minimal",
    name: "미니멀 톤",
    badge: "테크 / 리빙 / 패션",
    description: "순백 배경 + 자연광 연출로 제품을 인테리어 오브제처럼 표현. 텍스트는 최소화하고 제품 비주얼과 여백이 중심. 디자인 자체가 경쟁력인 제품, 라이프스타일 감성을 담고 싶은 제품에 적합",
    recommend: "신일 무선 BLDC팬 레퍼런스",
    styleClass: "bg-[#FFFFFF] border-gray-200 text-gray-700",
    accentColor: "#444444",
  },
];

export default function ToneSelectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedTone, setSelectedTone] = useState<string>("");
  const [selectedFont, setSelectedFont] = useState<string>("recommended");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    // 활성 세션 불러오기
    getActiveSession(user.uid)
      .then((activeSession) => {
        if (!activeSession) {
          alert("활성화된 콘티 작업이 없습니다. 콘티 생성을 먼저 완료해 주세요.");
          router.push("/generate");
          return;
        }
        setSession(activeSession);
        if (activeSession.selectedTone) {
          setSelectedTone(activeSession.selectedTone);
        }
        if (activeSession.fontChoice) {
          setSelectedFont(activeSession.fontChoice);
        }
      })
      .catch((err) => {
        console.error("세션 로드 오류:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, authLoading, router]);

  const handleSelectTone = (toneId: string) => {
    setSelectedTone(toneId);
  };

  const handleNext = async () => {
    if (!selectedTone || !session) return;
    setSaving(true);
    try {
      const isNewTone = session.selectedTone !== selectedTone;
      
      // 이미 톤이 설정되어 있는데 다른 톤으로 변경하는 경우 디자인 재생성 카운트 확인 및 차감
      if (session.selectedTone && isNewTone) {
        if (session.designGenCount >= 5) {
          alert("디자인 재생성 횟수(최대 5회)를 모두 소진하셨습니다. 기존 톤으로만 제작 가능합니다.");
          setSelectedTone(session.selectedTone);
          setSaving(false);
          return;
        }
        
        // 디자인 재생성 횟수 1회 증가
        await incrementDesignGen(session.id);
      }

      // 디자인 톤 + 폰트 DB 저장
      await updateDesignTone(session.id, selectedTone);
      await updateFontChoice(session.id, selectedFont || "recommended");

      // 다음 업로드 단계로 이동
      router.push("/generate/upload");
    } catch (err) {
      console.error("디자인 톤 저장 오류:", err);
      alert("설정 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 font-semibold animate-pulse">디자인 세션 로딩 중...</div>
      </div>
    );
  }

  // 남은 재생성 횟수 계산
  const remainingGen = session ? Math.max(0, 5 - session.designGenCount) : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      {/* 상단바 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/generate" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" /> 콘티 결과로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-800 font-bold px-3 py-1.5 rounded-full">
              디자인 자동화 ✦ 1단계
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-12">
        {/* 타이틀 및 가이드 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-7 h-7 text-blue-600 animate-pulse" />
            상세페이지의 디자인 톤을 선택해 주세요
          </h1>
          <p className="text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
            원하시는 비주얼 분위기를 1종 선택하시면, AI가 콘티 카피와 이미지들을 해당 톤앤매너 테마에 맞추어 예쁘게 배치하고 조립합니다.
          </p>
          
          {session && session.selectedTone && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              주의: 이미 생성된 디자인 톤 변경 시, 디자인 재생성 횟수가 차감됩니다. 
              (남은 재생성 횟수: <span className="font-bold text-amber-700">{remainingGen}회</span> / 5회)
            </div>
          )}
        </div>

        {/* 톤 선택 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {TONE_LIST.map((tone) => {
            const isSelected = selectedTone === tone.id;
            return (
              <div
                key={tone.id}
                onClick={() => handleSelectTone(tone.id)}
                className={`cursor-pointer rounded-2xl border-3 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 flex flex-col ${
                  isSelected
                    ? "border-blue-600 ring-4 ring-blue-100"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* 비주얼 카드 상단 테마 썸네일 대용 스타일 헤더 */}
                <div className={`h-24 p-5 flex flex-col justify-end ${tone.styleClass} border-b border-gray-100`}>
                  <span 
                    className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full self-start mb-2"
                    style={{ backgroundColor: isSelected ? "#3b82f6" : "#e5e7eb", color: isSelected ? "#fff" : "#4b5563" }}
                  >
                    {tone.badge.split(" / ")[0]} 등 추천
                  </span>
                  <h3 className="text-xl font-black">{tone.name}</h3>
                </div>
                
                {/* 본문 설명 */}
                <div className="bg-white p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold tracking-wider mb-2">추천 카테고리</p>
                    <p className="text-xs font-bold text-gray-700 mb-4">{tone.badge}</p>
                    
                    <p className="text-xs text-gray-400 font-semibold tracking-wider mb-2">톤 특징</p>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{tone.description}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded font-semibold">
                      {tone.recommend}
                    </span>
                    <button
                      type="button"
                      className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {isSelected ? "선택됨" : "선택하기"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 폰트 선택 */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-black text-gray-900 mb-1">폰트를 선택해 주세요</h2>
            <p className="text-sm text-gray-500">선택하지 않으면 선택한 톤에 맞는 추천 폰트가 자동 적용됩니다.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {/* 추천 옵션 */}
            <button
              onClick={() => setSelectedFont("recommended")}
              className={`relative border-2 rounded-2xl p-4 text-left transition-all duration-200 ${
                selectedFont === "recommended"
                  ? "border-blue-600 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {selectedFont === "recommended" && (
                <span className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-0.5">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="text-xs font-bold text-blue-600 mb-2">추천</div>
              <div className="text-base font-black text-gray-900">자동 적용</div>
              <div className="text-xs text-gray-400 mt-1 leading-relaxed">
                {selectedTone
                  ? `→ ${FONT_OPTIONS.find(f => f.id === TONE_RECOMMENDED_FONT[selectedTone])?.label ?? "톤 기본 폰트"}`
                  : "톤 선택 후 결정"}
              </div>
            </button>

            {/* 6종 폰트 */}
            {FONT_OPTIONS.map((font) => (
              <button
                key={font.id}
                onClick={() => setSelectedFont(font.id)}
                className={`relative border-2 rounded-2xl p-4 text-left transition-all duration-200 ${
                  selectedFont === font.id
                    ? "border-blue-600 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {selectedFont === font.id && (
                  <span className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-0.5">
                    <Check className="w-3 h-3" />
                  </span>
                )}
                <div className="text-xs text-gray-400 mb-2">미리보기</div>
                <div
                  className="text-base font-bold text-gray-900 leading-snug"
                  style={{ fontFamily: font.cssFamily }}
                >
                  와디즈 펀딩
                </div>
                <div className="text-xs text-gray-500 mt-1.5 font-medium">{font.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 하단 행동 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={handleNext}
            disabled={!selectedTone || saving}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-center text-lg tracking-wide disabled:cursor-not-allowed"
          >
            {saving ? "설정 저장 중..." : "다음 단계로 (사진 업로드) ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}
