import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getSystemPrompt, buildUserPrompt, SYSTEM_PROMPT_REVISION } from "@/lib/system-prompt";
import { FormData } from "@/lib/types";
import fs from "fs";
import path from "path";

function loadKnowledge(_pageType: "wadiz" | "general"): string {
  const dir = path.join(process.cwd(), "knowledge");
  const read = (file: string) => {
    try { return fs.readFileSync(path.join(dir, file), "utf-8"); } catch { return ""; }
  };

  let knowledge = "\n\n---\n\n# 참고 자료 (카피 작성 전 반드시 참고할 것)\n\n";
  knowledge += "## 광고 카피 아카이빙\n\n" + read("copy-archive.md") + "\n\n";
  knowledge += "## 상세페이지 도입부 카피 예시\n\n" + read("intro-copy-examples.md") + "\n\n";

  // 와디즈 콘티 예시는 두 타입 모두 참고
  for (let i = 1; i <= 5; i++) {
    const content = read(`conti-example-${i}.md`);
    if (content) knowledge += `## 와디즈 상세페이지 콘티 예시 ${i}\n\n` + content + "\n\n";
  }

  // knowledge 폴더의 추가 .md 파일을 자동으로 읽어 주입
  // (위에서 명시적으로 읽은 파일은 제외)
  const fixedFiles = new Set([
    "copy-archive.md",
    "intro-copy-examples.md",
    ...Array.from({ length: 5 }, (_, i) => `conti-example-${i + 1}.md`),
  ]);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md") && !fixedFiles.has(entry.name)) {
        const content = read(entry.name);
        if (content) {
          const title = entry.name.replace(/\.md$/, "").replace(/-/g, " ");
          knowledge += `## ${title}\n\n` + content + "\n\n";
        }
      }
    }
  } catch { /* knowledge 폴더 읽기 실패 시 무시 */ }

  return knowledge;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { formData, previousOutput, revisionRequest }: {
      formData: FormData;
      previousOutput?: string;
      revisionRequest?: string;
    } = await req.json();

    if (!formData?.productName) {
      return new Response(JSON.stringify({ error: "제품명은 필수입니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pageType = formData.pageType ?? "wadiz";
    const isRevision = !!(previousOutput && revisionRequest);

    const systemPrompt = isRevision
      ? SYSTEM_PROMPT_REVISION
      : getSystemPrompt(pageType) + loadKnowledge(pageType);

    const userMessage = isRevision
      ? `아래는 기존에 작성된 콘티입니다:\n\n${previousOutput}\n\n---\n\n수정 요청: ${revisionRequest}`
      : buildUserPrompt(formData);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const response = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" }
              }
            ],
            messages: [{ role: "user", content: userMessage }],
          });

          for await (const chunk of response) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "생성 오류";
          controller.enqueue(encoder.encode(`\n\n[오류: ${msg}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "서버 오류가 발생했습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
