import { NextRequest, NextResponse } from "next/server";
import { generateDesignLayout } from "@/lib/design-ai";

export async function POST(req: NextRequest) {
  try {
    const { sectionId, contiText, selectedTone, uploadedImageCount } = await req.json();
    if (!sectionId || !contiText) {
      return NextResponse.json({ error: "sectionId, contiText 필요" }, { status: 400 });
    }

    // 해당 섹션만 재생성 (전체 레이아웃 재분석 후 해당 id만 추출)
    const allSections = await generateDesignLayout(
      contiText,
      selectedTone ?? "minimal",
      uploadedImageCount ?? 0
    );
    const newSection = allSections.find((s) => s.id === sectionId);

    if (!newSection) {
      return NextResponse.json({ error: "섹션 재생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true, section: newSection });
  } catch (err) {
    console.error("Section regen error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
