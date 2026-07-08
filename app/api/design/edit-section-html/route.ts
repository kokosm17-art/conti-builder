import { NextRequest, NextResponse } from "next/server";
import { editSectionHtml } from "@/lib/html-design-ai";

export async function POST(req: NextRequest) {
  try {
    const { sectionHtml, instruction, toneId } = await req.json();

    if (!sectionHtml || !instruction) {
      return NextResponse.json({ error: "섹션 HTML 또는 수정 지시사항 없음" }, { status: 400 });
    }

    const updatedHtml = await editSectionHtml(
      sectionHtml,
      instruction,
      toneId ?? "minimal"
    );

    return NextResponse.json({ success: true, sectionHtml: updatedHtml });
  } catch (err) {
    console.error("HTML section edit error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
