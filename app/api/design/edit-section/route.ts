import { NextRequest, NextResponse } from "next/server";
import { editDesignSection } from "@/lib/design-ai";
import { DesignSection } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { section, instruction, selectedTone } = await req.json();
    if (!section || !instruction?.trim()) {
      return NextResponse.json({ error: "section, instruction 필요" }, { status: 400 });
    }

    const updated = await editDesignSection(section as DesignSection, instruction, selectedTone ?? "minimal");
    return NextResponse.json({ success: true, section: updated });
  } catch (err) {
    console.error("Section edit error:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
