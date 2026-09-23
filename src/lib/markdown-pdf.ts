import type { jsPDF } from "jspdf";

// Turns markdown into real, selectable jsPDF text — headings, bullet/
// numbered lists, blockquotes, code fences, horizontal rules, and
// paragraphs with inline **bold**/*italic* spans, word-wrapped and
// paginated automatically. Deliberately not pixel-perfect (no embedded
// images, no exotic GFM features) — used anywhere a project's written
// content (Background/Notes, a bio-notes block, a citation) needs to go
// into a PDF export rather than a rendered-HTML screenshot.

export type MarkdownPdfOptions = {
  x: number;
  maxWidth: number;
  pageHeight: number;
  marginBottom: number;
  // Body paragraph font size — headings/code scale relative to this.
  // Defaults to 10.
  fontSize?: number;
};

type ParagraphOptions = MarkdownPdfOptions & {
  // Left margin added to every line after the first — used for a bullet/
  // number's hanging indent, or a blockquote's indent.
  continuationIndent?: number;
  // Renders every word in italics regardless of its own **/*_ markers —
  // used for a blockquote.
  italic?: boolean;
};

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; index: number; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

type Span = { text: string; bold: boolean; italic: boolean };
type Word = { text: string; bold: boolean; italic: boolean; isSpace: boolean };

// level 1..6 sizes, largest first.
const HEADING_SIZES = [18, 15, 13, 11.5, 11, 11];

function stripInlineLinks(text: string): string {
  // [label](url) -> label; a bare URL or <autolink> is left as-is, since
  // there's nowhere for the reader to click in a static PDF either way.
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: stripInlineLinks(heading[2].trim()) });
      i++;
      continue;
    }

    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence (or run off the end if it's unterminated)
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push({ type: "bullet", text: stripInlineLinks(bullet[1]) });
      i++;
      continue;
    }

    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      blocks.push({ type: "numbered", index: Number(numbered[1]), text: stripInlineLinks(numbered[2]) });
      i++;
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const quoteLines = [quote[1]];
      i++;
      while (i < lines.length) {
        const m = /^>\s?(.*)$/.exec(lines[i]);
        if (!m) break;
        quoteLines.push(m[1]);
        i++;
      }
      blocks.push({ type: "quote", text: stripInlineLinks(quoteLines.join(" ")) });
      continue;
    }

    // Paragraph: accumulate lines until a blank line or the start of
    // another block type, then reflow them into one string — a paragraph
    // wraps to the PDF's own width anyway, so preserving the source's
    // line breaks would be meaningless here.
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: stripInlineLinks(paraLines.join(" ")) });
  }

  return blocks;
}

// Splits text on **bold**/__bold__/*italic*/_italic_ markers into styled
// runs — anything not inside a marker comes back as one plain span.
function parseInlineSpans(text: string): Span[] {
  const spans: Span[] = [];
  const regex = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[1] !== undefined) spans.push({ text: match[1], bold: true, italic: false });
    else if (match[2] !== undefined) spans.push({ text: match[2], bold: true, italic: false });
    else if (match[3] !== undefined) spans.push({ text: match[3], bold: false, italic: true });
    else if (match[4] !== undefined) spans.push({ text: match[4], bold: false, italic: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex), bold: false, italic: false });
  return spans.length > 0 ? spans : [{ text, bold: false, italic: false }];
}

// Breaks spans into word/whitespace tokens, each carrying its span's
// style — the unit renderParagraph actually wraps and measures.
function spansToWords(spans: Span[]): Word[] {
  const words: Word[] = [];
  for (const span of spans) {
    const parts = span.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const part of parts) {
      words.push({ text: part, bold: span.bold, italic: span.italic, isSpace: /^\s+$/.test(part) });
    }
  }
  return words;
}

function fontStyleFor(bold: boolean, italic: boolean): string {
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
}

// Renders one inline-styled, word-wrapped paragraph starting at (x, y),
// adding pages as needed, and returns the y position immediately below
// its last line — the unit both renderMarkdownToPdf's own paragraph/quote
// blocks and a hanging-indent reference citation are built from.
export function renderParagraph(doc: jsPDF, text: string, x: number, y: number, opts: ParagraphOptions): number {
  const fontSize = opts.fontSize ?? 10;
  const lineHeight = fontSize * 1.35;
  doc.setFontSize(fontSize);

  const words = spansToWords(parseInlineSpans(text));
  const indent = opts.continuationIndent ?? 0;
  const rightEdge = x + opts.maxWidth;

  let isFirstLine = true;
  let cursorY = y;
  const lineStart = () => (isFirstLine ? x : x + indent);
  let cursorX = lineStart();

  function newLine() {
    cursorY += lineHeight;
    if (cursorY > opts.pageHeight - opts.marginBottom) {
      doc.addPage();
      cursorY = opts.marginBottom;
    }
    isFirstLine = false;
    cursorX = lineStart();
  }

  const spaceWidth = doc.getTextWidth(" ");
  for (const word of words) {
    if (word.isSpace) {
      if (cursorX > lineStart()) cursorX += spaceWidth;
      continue;
    }
    doc.setFont("helvetica", fontStyleFor(word.bold, word.italic || Boolean(opts.italic)));
    const width = doc.getTextWidth(word.text);
    if (cursorX + width > rightEdge && cursorX > lineStart()) newLine();
    doc.text(word.text, cursorX, cursorY);
    cursorX += width;
  }
  doc.setFont("helvetica", "normal");
  return cursorY + lineHeight;
}

// Renders a full markdown document into `doc` starting at `startY`, and
// returns the y position immediately below the last block — so a caller
// composing a multi-section PDF (the whole-project export) can keep
// stacking content after it.
export function renderMarkdownToPdf(doc: jsPDF, markdown: string, startY: number, opts: MarkdownPdfOptions): number {
  const bodySize = opts.fontSize ?? 10;
  let y = startY;

  function ensureRoom(needed: number) {
    if (y + needed > opts.pageHeight - opts.marginBottom) {
      doc.addPage();
      y = opts.marginBottom;
    }
  }

  for (const block of parseMarkdownBlocks(markdown)) {
    switch (block.type) {
      case "heading": {
        const size = HEADING_SIZES[Math.min(block.level, HEADING_SIZES.length) - 1];
        ensureRoom(size * 1.4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(size);
        doc.text(block.text, opts.x, y);
        doc.setFont("helvetica", "normal");
        y += size * 1.4 + 4;
        break;
      }
      case "paragraph":
        y = renderParagraph(doc, block.text, opts.x, y, { ...opts, fontSize: bodySize }) + 4;
        break;
      case "bullet": {
        const indent = 14;
        ensureRoom(bodySize * 1.4);
        doc.setFontSize(bodySize);
        doc.setFont("helvetica", "normal");
        doc.text("•", opts.x, y);
        y =
          renderParagraph(doc, block.text, opts.x + indent, y, {
            ...opts,
            maxWidth: opts.maxWidth - indent,
            fontSize: bodySize,
          }) + 2;
        break;
      }
      case "numbered": {
        const indent = 18;
        ensureRoom(bodySize * 1.4);
        doc.setFontSize(bodySize);
        doc.setFont("helvetica", "normal");
        doc.text(`${block.index}.`, opts.x, y);
        y =
          renderParagraph(doc, block.text, opts.x + indent, y, {
            ...opts,
            maxWidth: opts.maxWidth - indent,
            fontSize: bodySize,
          }) + 2;
        break;
      }
      case "quote": {
        const indent = 12;
        y =
          renderParagraph(doc, block.text, opts.x + indent, y, {
            ...opts,
            maxWidth: opts.maxWidth - indent,
            fontSize: bodySize,
            italic: true,
          }) + 4;
        break;
      }
      case "code": {
        const codeSize = bodySize - 1;
        const codeLineHeight = codeSize * 1.3;
        doc.setFont("courier", "normal");
        doc.setFontSize(codeSize);
        for (const line of block.text.split("\n")) {
          ensureRoom(codeLineHeight);
          doc.text(line, opts.x, y);
          y += codeLineHeight;
        }
        doc.setFont("helvetica", "normal");
        y += 4;
        break;
      }
      case "hr": {
        ensureRoom(10);
        doc.setDrawColor(180);
        doc.line(opts.x, y, opts.x + opts.maxWidth, y);
        doc.setDrawColor(0);
        y += 10;
        break;
      }
    }
  }

  return y;
}
