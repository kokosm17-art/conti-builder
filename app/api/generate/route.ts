import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getSystemPrompt, buildUserPrompt } from "@/lib/system-prompt";
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
    const systemPrompt = getSystemPrompt(pageType) + loadKnowledge(pageType);

    const isRevision = !!(previousOutput && revisionRequest);
    const userMessage = isRevision
      ? `아래는 기존에 작성된 콘티입니다:\n\n${previousOutput}\n\n---\n\n위 콘티를 다음 요청에 따라 수정해 주세요:\n${revisionRequest}\n\n수정 시 전체 콘티를 다시 완성된 형태로 출력해 주세요.`
      : buildUserPrompt(formData);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const response = client.messages.stream({
            model: "claude-3-5-sonnet-latest",
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
