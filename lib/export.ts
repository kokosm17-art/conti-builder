import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

export async function generateDocx(rawText: string, productName: string) {
  const children: Paragraph[] = [];
  const lines = rawText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );
    } else if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        })
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/\*\*/g, ""), bold: true })],
        })
      );
    } else if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              italics: true,
              color: "666666",
            }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { before: 100, after: 100 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed })],
          spacing: { after: 60 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
    creator: "상세페이지의 정석",
    title: `${productName} 상세페이지 콘티`,
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${productName}_콘티.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
