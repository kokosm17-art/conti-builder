import { SectionChangeInfo } from "@/lib/format-output";

export function ContiSectionBlock({
  title,
  content,
  onCopy,
  revising = false,
  changeInfo,
}: {
  title: string;
  content: string;
  onCopy: (text: string) => void;
  revising?: boolean;
  changeInfo?: SectionChangeInfo;
}) {
  const isChanged = !revising && !!changeInfo;
  const contentChanged = isChanged && !!changeInfo?.content;

  return (
    <div
      className="border rounded-2xl overflow-hidden transition-all duration-500"
      style={
        revising
          ? { borderColor: "#60a5fa", boxShadow: "0 0 0 2px #dbeafe" }
          : isChanged
          ? { borderColor: "#34d399", boxShadow: "0 0 0 2px #d1fae5" }
          : { borderColor: "#e5e7eb" }
      }
    >
      {/* 헤더 */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={isChanged ? { backgroundColor: "#065f46" } : { backgroundColor: "#111827" }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold">{title}</h3>
          {revising && (
            <span className="text-xs text-blue-300 animate-pulse">수정 중...</span>
          )}
          {isChanged && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#34d399", color: "#022c22" }}
            >
              수정됨 ✓
            </span>
          )}
        </div>
        <button
          onClick={() => onCopy(content)}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 rounded-lg px-3 py-1 transition-colors"
        >
          복사
        </button>
      </div>

      {/* 콘티 본문 */}
      <div
        className="px-6 py-6 transition-colors duration-500"
        style={
          contentChanged
            ? { backgroundColor: "#f0fdf4", borderLeft: "4px solid #34d399" }
            : {}
        }
      >
        {contentChanged && (
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "#34d399" }}
            />
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "#d1fae5", color: "#065f46" }}
            >
              콘티 내용 변경됨
            </span>
          </div>
        )}
        <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-loose font-[family-name:var(--font-noto)]">
          {content}
        </pre>
      </div>
    </div>
  );
}
