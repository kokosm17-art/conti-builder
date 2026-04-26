"use client";

import Link from "next/link";
import React from "react";

const DEMO_EXAMPLE = {
  brand: "에어클린 프로",
  mainCustomer: "영유아 자녀를 둔 30~40대 부모",
  painPoint: "미세먼지로 인한 실내 공기질 저하로 가족 건강이 걱정됩니다",
  usp: "NASA 기술 기반 3단계 필터링으로 99.9% 미세먼지 제거",
};

const DEMO_CONTI = [
  {
    section: "도입부",
    intent: "기존 공기청정기에 실망한 경험을 먼저 꺼내 공감을 유도하고, 우리 제품이 다른 이유를 궁금하게 만든다.",
    lines: [
      "필터 갈 때마다 드는 생각",
      "\"이게 진짜 되고 있는 건가?\"",
      "",
      "바람만 돌리는 기계 말고",
      "세균까지 죽이는 공기청정기",
      "",
      "(제품 전면 클린샷 / 빛 반사 연출)",
      "",
      "에어클린 프로",
      "공기를 정화하는 게 아니라",
      "공기를 재설계합니다",
    ],
  },
  {
    section: "본론부",
    intent: "핵심 기술을 숫자와 비교로 풀어내 신뢰를 쌓고, 사용자의 일상 변화를 구체적으로 그려준다.",
    lines: [
      "POINT 01. NASA가 선택한 필터 기술",
      "우주정거장 공기 정화에 쓰이던",
      "3단계 복합 필터링 시스템",
      "",
      "미세먼지 0.1μm까지",
      "99.9% 제거율 실증",
      "",
      "(필터 구조 단면 비교 이미지)",
    ],
  },
  {
    section: "결론부",
    intent: "가격 혜택과 보증으로 마지막 망설임을 제거하고, 지금 행동해야 할 이유를 만든다.",
    lines: [
      "정가 280,000원",
      "와디즈 특가 189,000원",
      "",
      "얼리버드 100명 한정",
      "32% 할인 + 필터 1년 무상 제공",
      "",
      "KC 인증 · 누적 리뷰 3,500개 ★4.85",
    ],
  },
];

export default function LandingPage() {

  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">
              상세페이지의 정석 ✦
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#builder" className="hover:text-gray-900 transition-colors">콘티 빌더</a>
            <a href="#framework" className="hover:text-gray-900 transition-colors">차별점</a>
            <a href="#stats" className="hover:text-gray-900 transition-colors">성과</a>
          </nav>
          <Link
            href="/login"
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            시작하기
          </Link>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-snug tracking-tight text-gray-900 mb-6">
            누적 <span className="text-blue-600">400억</span> 매출의 법칙,<br />
            당신의 상세페이지에<br />
            이식하세요.
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-10 leading-relaxed">
            1,000개 프로젝트를 성공시킨 와디즈 PD 출신<br />
            독보적인 &apos;성공 DNA&apos;를 이 도구에 모두 담았습니다.
          </p>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-5 py-3 rounded-full mb-3">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            클릭 한 번으로 &apos;팔리는 콘티&apos;를 만들어보세요.
          </div>
          <p className="text-xs text-gray-400 mb-10">
            * 콘티란? 상세페이지의 뼈대가 되는 기획안입니다
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/generate"
              className="bg-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors text-base w-full sm:w-auto text-center"
            >
              지금 콘티 만들기
            </Link>
            <a
              href="#framework"
              className="border border-gray-300 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors text-base w-full sm:w-auto text-center"
            >
              차별점 보기
            </a>
          </div>
        </div>
      </section>

      {/* 실적 카드 */}
      <section id="stats" className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "👥", value: "1,000+", label: "프로젝트 디렉팅" },
            { icon: "📈", value: "400억+", label: "누적 매출 (KRW)" },
            { icon: "🏆", value: "성과 1위", label: "3년 연속 기록" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                {s.icon}
              </div>
              <div className="text-3xl font-black text-gray-900 mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a href="#builder" className="text-gray-500 text-sm hover:text-gray-700">
            콘티 빌더 체험하기 ↓
          </a>
        </div>
      </section>

      {/* 성공 프레임워크 비교표 */}
      <section id="framework" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-3">HERO SECTION</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-4">
              설명만 하는 상세페이지는 이제 그만.
            </h2>
            <p className="text-gray-500">
              좋은 제품인데 왜 안 팔릴까? 핵심은 나열이 아니라 <strong>&apos;후킹&apos;</strong>입니다.<br />
              매출을 만드는 상세페이지의 정석
            </p>
          </div>

          {/* 비교표 */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 overflow-x-auto">
            <div className="grid grid-cols-3 min-w-[560px]">
              {/* 헤더 */}
              <div className="bg-gray-900 p-5"></div>
              <div className="bg-gray-100 p-5 text-center font-bold text-gray-700 text-sm border-l border-gray-200">
                타 AI 서비스 / 일반 외주
              </div>
              <div className="bg-blue-600 p-5 text-center font-bold text-white text-sm">
                상세페이지의 정석
              </div>

              {/* 행 */}
              {[
                { label: "기획의 깊이", bad: "단순 정보 나열형 텍스트 생성", good: "400억 매출 DNA 기반 후킹 기획" },
                { label: "제작 방식", bad: "일관된 톤의 기계적 생성", good: "제품별 맞춤형 기획" },
                { label: "비용 효율", bad: "수백만 원대의 높은 외주비", good: "외주 대비 1/10 수준의 합리적 가격" },
                { label: "수정 범위", bad: "수정 횟수 3~5회 및 추가 비용 발생", good: "수정횟수 30회, 추가 비용 없음" },
              ].map((row, i) => (
                <React.Fragment key={i}>
                  <div className="bg-gray-900 p-5 text-white font-semibold text-sm border-t border-gray-700">
                    {row.label}
                  </div>
                  <div className="bg-gray-50 p-5 text-gray-500 text-sm border-l border-t border-gray-200">
                    <span className="text-red-400 mr-2">✕</span>{row.bad}
                  </div>
                  <div className="bg-blue-600 p-5 text-white text-sm border-t border-blue-500">
                    <span className="mr-2">✓</span>{row.good}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 콘티 빌더 섹션 */}
      <section id="builder" className="py-20 px-6 bg-blue-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-3">INTERACTIVE STORYBOARD BUILDER</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-4">
              팔리는 상세페이지 콘티,<br />지금 바로 만들어보세요
            </h2>
            <p className="text-gray-500">
              입력만으로 전문가의 DNA를 이식해 드립니다.<br />
              단 3분 만에 완성해 보세요.
            </p>
          </div>

          {/* 미리보기 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 좌: 입력 예시 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">입력 예시</span>
                <span className="text-xs text-gray-400">실제 서비스에서는 직접 입력합니다</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: "브랜드/제품명", value: DEMO_EXAMPLE.brand },
                  { label: "메인 고객", value: DEMO_EXAMPLE.mainCustomer },
                  { label: "고객의 핵심 고민", value: DEMO_EXAMPLE.painPoint },
                  { label: "핵심 차별점 (USP)", value: DEMO_EXAMPLE.usp },
                ].map((item) => (
                  <div key={item.label} className="border border-gray-100 rounded-xl p-3">
                    <div className="text-xs font-bold text-gray-400 mb-1">{item.label}</div>
                    <div className="text-sm text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Link href="/generate" className="bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  직접 만들기 →
                </Link>
              </div>
            </div>

            {/* 우: 콘티 샘플 출력 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 overflow-y-auto max-h-[480px]">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">✦</span>
                <span className="font-bold text-gray-900">AI 생성 콘티 예시</span>
                <span className="text-xs text-gray-400 ml-auto">실제 출력 샘플</span>
              </div>
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600 font-semibold">실제 AI 콘티는 A4 3~4페이지 분량으로 더 상세하게 생성됩니다</p>
                </div>
                {DEMO_CONTI.map((block) => (
                  <div key={block.section} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="bg-gray-900 px-4 py-2.5">
                      <span className="text-white text-xs font-bold">{block.section}</span>
                    </div>
                    <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                      <div className="text-xs font-bold text-blue-600 mb-1">기획 의도</div>
                      <p className="text-xs text-blue-800 leading-relaxed">{block.intent}</p>
                    </div>
                    <div className="px-4 py-3">
                      {block.lines.map((line, i) => (
                        <div key={i} className={`text-xs leading-relaxed ${line === "" ? "h-2" : "text-gray-700"}`}>
                          {line.startsWith("(") ? <span className="text-blue-500">{line}</span> : line}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 숫자 성과 섹션 */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-3">TRACK RECORD</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2">숫자가 증명하는 성과</h2>
            <p className="text-gray-500">7년간 쌓아온 실적, 데이터로 확인하세요</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "400억", label: "누적 매출 (KRW)" },
              { value: "1,000+", label: "프로젝트" },
              { value: "15+", label: "멀티 카테고리" },
              { value: "7년", label: "업계 경력" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
                <div className="text-3xl font-black text-gray-900 mb-1">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-blue-50 rounded-3xl p-8 sm:p-12 text-center">
            <div className="text-blue-600 text-xs font-bold tracking-widest uppercase mb-4">GET STARTED</div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">
              전문가의 성공 DNA를 담은<br />팔리는 콘티, 지금 만들어보세요.
            </h2>
            <p className="text-gray-500 mb-8 text-sm">
              지금 시작하면 첫 콘티 제작비 <strong>무료</strong> 혜택을 드립니다
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/generate"
                className="bg-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors text-sm w-full sm:w-auto"
              >
                콘티 제작 시작하기 →
              </Link>
              <Link
                href="/register"
                className="border border-gray-300 text-gray-700 font-semibold px-8 py-4 rounded-xl hover:bg-white transition-colors text-sm w-full sm:w-auto"
              >
                무료로 시작하기
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-400">
              <span>✦ 정보 작성 후 즉시 완성</span>
              <span>✦ 추가 비용없이 30회 수정</span>
              <span>✦ 제품별 맞춤형 기획</span>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center">
        <p className="text-sm text-gray-400">
          © 2025 상세페이지의 정석. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
