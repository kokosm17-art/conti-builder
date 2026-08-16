import { NextRequest, NextResponse } from "next/server";
import { generateHtmlDesign } from "@/lib/html-design-ai";

export async function POST(req: NextRequest) {
  try {
    const { contiText, selectedTone, fontChoice, colorChoice, alignChoice } = await req.json();

    if (!contiText) {
      return NextResponse.json({ error: "콘티 데이터 없음" }, { status: 400 });
    }

    const htmlDesign = await generateHtmlDesign(
      contiText,
      selectedTone ?? "minimal",
      fontChoice ?? "recommended",
      colorChoice ?? "recommended",
      alignChoice ?? "recommended"
    );

    return NextResponse.json({ success: true, htmlDesign });
  } catch (err) {
    console.error("HTML design generate error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
