import { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, LineRuleType, HeadingLevel, PageNumber, NumberFormat } from "docx";
import saveAs from "file-saver";
import { Block, BookMetadata } from "../types";

export const exportToWord = async (blocks: Block[], metadata: BookMetadata) => {
  // 1. Prepare Metadata
  const authorName = metadata.author || "Author";
  const title = metadata.title || "Untitled";
  // Extract last name for filename/header if possible, else use full name or specific "Wawer" requirement
  const lastName = authorName.split(' ').pop() || "Wawer";
  
  // Clean title for filename
  const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  const filename = `${lastName}_${cleanTitle}.docx`;

  // 2. Define Styles / Formatting Constants
  // Size 24 = 12pt (docx uses half-points)
  // Line Spacing 360 = 1.5 lines (240 is single)
  // Indentation 720 = 0.5 inch (1440 twips = 1 inch)
  const font = "Times New Roman";
  const fontSize = 24; 
  
  const children: Paragraph[] = [];

  // --- Title Page Content (Centered) ---
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240, line: 360, lineRule: LineRuleType.AUTO },
      run: { font: font, size: fontSize, bold: true }
    })
  );

  children.push(
    new Paragraph({
      text: `by ${authorName}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 480, line: 360, lineRule: LineRuleType.AUTO },
      run: { font: font, size: fontSize }
    })
  );

  // --- Manuscript Body ---
  blocks.forEach(block => {
    if (!block.content.trim() && block.type !== 'hr') return;

    if (block.type === 'h1' || block.type === 'h2') {
      // Headers: Centered, Bold, No Indent
      children.push(
        new Paragraph({
          text: block.content,
          alignment: AlignmentType.CENTER,
          heading: block.type === 'h1' ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120, line: 360, lineRule: LineRuleType.AUTO },
          run: { font: font, size: fontSize, bold: true }
        })
      );
    } else if (block.type === 'hr') {
      // Scene Break: Centered Hash
      children.push(
        new Paragraph({
          text: "#",
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240, line: 360, lineRule: LineRuleType.AUTO },
          run: { font: font, size: fontSize }
        })
      );
    } else {
      // Paragraph: 0.5in Indent, Justified or Left
      children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: block.content,
                    font: font,
                    size: fontSize,
                })
            ],
            spacing: { line: 360, lineRule: LineRuleType.AUTO }, // 1.5 spacing
            indent: { firstLine: 720 }, // 0.5 inch indent
            alignment: AlignmentType.LEFT
        })
      );
    }
  });

  // 3. Create Document Structure
  const doc = new Document({
    styles: {
        paragraphStyles: [
            {
                id: "Normal",
                name: "Normal",
                run: {
                    font: font,
                    size: fontSize,
                },
                paragraph: {
                    spacing: { line: 360, lineRule: LineRuleType.AUTO },
                },
            },
        ],
    },
    sections: [
      {
        properties: {
            page: {
                margin: {
                    top: "1in", // 1440 twips
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
                    new TextRun({ text: `${lastName} / ${title} / `, font: font, size: fontSize }),
                    new TextRun({
                        children: [PageNumber.CURRENT],
                        font: font,
                        size: fontSize
                    })
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  // 4. Pack and Download
  try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, filename);
      return true;
  } catch (error) {
      console.error("Export failed", error);
      throw error;
  }
};