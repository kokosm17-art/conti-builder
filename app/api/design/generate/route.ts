import { NextRequest, NextResponse } from "next/server";
import { generateDesignLayout } from "@/lib/design-ai";

export async function POST(req: NextRequest) {
  try {
    const { contiText, selectedTone, uploadedImageCount } = await req.json();

    if (!contiText) {
      return NextResponse.json({ error: "콘티 데이터 없음" }, { status: 400 });
    }

    const sections = await generateDesignLayout(
      contiText,
      selectedTone ?? "minimal",
      uploadedImageCount ?? 0
    );

    return NextResponse.json({ success: true, sections });
  } catch (err) {
    console.error("Design generate error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
