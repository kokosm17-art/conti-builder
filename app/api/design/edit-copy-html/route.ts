import { NextRequest, NextResponse } from "next/server";
import { editCopyHtml } from "@/lib/html-design-ai";

export async function POST(req: NextRequest) {
  try {
    const { copyHtml, instruction, toneId, colorChoice } = await req.json();

    if (!copyHtml || !instruction) {
      return NextResponse.json({ error: "카피 HTML 또는 수정 지시사항 없음" }, { status: 400 });
    }

    const updatedHtml = await editCopyHtml(
      copyHtml,
      instruction,
      toneId ?? "minimal",
      colorChoice ?? "recommended"
    );

    return NextResponse.json({ success: true, copyHtml: updatedHtml });
  } catch (err) {
    console.error("HTML copy edit error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
