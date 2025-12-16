import { Document, Packer, Paragraph, TextRun, Header, AlignmentType, LineRuleType, HeadingLevel, PageNumber } from "docx";
import saveAs from "file-saver";
import { Block, BookMetadata } from "../types";

export const exportToWord = async (blocks: Block[], metadata: BookMetadata) => {
  const title = metadata.title || "Untitled";
  
  // Filename Rule: Wawer_[Title].docx
  // We sanitize the title to ensure it's a valid filename
  const safeTitle = title.replace(/[^a-z0-9\s-_]/gi, '').trim().replace(/\s+/g, '_');
  const filename = `Wawer_${safeTitle}.docx`;

  // Formatting Constants
  const font = "Times New Roman";
  const fontSize = 24; // 24 half-points = 12pt
  const lineSpacing = 360; // 240 = single, 360 = 1.5 lines
  const indent = 720; // 720 twips = 0.5 inch

  const children: Paragraph[] = [];

  // --- Title (Centered at top) ---
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.NO_HEADING,
      alignment: AlignmentType.CENTER,
      spacing: { after: 480, line: lineSpacing, lineRule: LineRuleType.AUTO }, // Extra space after title
      run: { font: font, size: fontSize, bold: false } // Standard manuscript title is often regular weight
    })
  );

  // Helper to create manuscript paragraphs
  const createParagraph = (text: string, isHeader: boolean = false) => {
      return new Paragraph({
        children: [
            new TextRun({
                text: text,
                font: font,
                size: fontSize,
                bold: isHeader
            })
        ],
        alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        // Only indent standard paragraphs, not headers or breaks
        indent: isHeader ? undefined : { firstLine: indent },
        spacing: { 
            line: lineSpacing, 
            lineRule: LineRuleType.AUTO,
            before: isHeader ? 240 : 0, // Space before headers
            after: isHeader ? 120 : 0   // Space after headers
        } 
      });
  };

  // --- Process Blocks ---
  blocks.forEach(block => {
      const text = block.content.trim();
      if (!text && block.type !== 'hr') return;

      if (block.type === 'h1' || block.type === 'h2') {
          // Headers are centered
          children.push(createParagraph(text, true));
      } else if (block.type === 'hr') {
           // Scene break is a centered hash
           children.push(
            new Paragraph({
                text: "#",
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 240, line: lineSpacing, lineRule: LineRuleType.AUTO },
                run: { font: font, size: fontSize }
            })
           );
      } else {
          // Standard Paragraph with Indent
          children.push(createParagraph(text, false));
      }
  });

  // --- Document Construction ---
  const doc = new Document({
    styles: {
        paragraphStyles: [
            {
                id: "Normal",
                name: "Normal",
                run: { font: font, size: fontSize },
                paragraph: { spacing: { line: lineSpacing, lineRule: LineRuleType.AUTO } },
            },
        ],
    },
    sections: [{
        properties: {
            page: {
                margin: {
                    top: "1in",
                    bottom: "1in",
                    left: "1in",
                    right: "1in",
                },
            },
        },
        headers: {
            default: new Header({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Wawer / ${title} / `, font: font, size: fontSize }),
                            new TextRun({
                                children: [PageNumber.CURRENT],
                                font: font,
                                size: fontSize
                            })
                        ],
                        alignment: AlignmentType.RIGHT,
                    })
                ]
            })
        },
        children: children
    }]
  });

  // Generate and Download
  try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, filename);
  } catch (error) {
      console.error("Export failed", error);
      throw error;
  }
};