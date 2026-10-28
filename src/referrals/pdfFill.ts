// Stamp text onto the flat Universal eXp-to-eXp PDF. The file has no AcroForm fields.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  ADDITIONAL_TERMS_BOX, BLANKS, BOXES, PDF_PAGE, checkedBoxes, pdfBaseline, pdfBox, shortUsDate, toWinAnsi,
  type LineBlank, type ReferralForm,
} from "./formModel.ts";

const INK = rgb(0.08, 0.08, 0.08);
const PAPER = rgb(1, 1, 1);

export function referralTemplateUrl(): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}forms/universal-exp-to-exp-referral-form.pdf`;
}

export async function loadReferralTemplate(): Promise<ArrayBuffer> {
  const url = referralTemplateUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The referral form template did not load (${res.status} ${url}).`);
  return res.arrayBuffer();
}

export async function fillReferralPdf(template: ArrayBuffer | Uint8Array, form: ReferralForm): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  if (pages.length < 3) throw new Error("The referral template is not the 3-page form.");
  const page1 = pages[0];
  const page2 = pages[1];
  const page3 = pages[2];
  if (!page1 || !page2 || !page3) throw new Error("The referral template is not the 3-page form.");

  paintLine(page1, font, BLANKS.originatingBrokerage, form.originatingBrokerage);
  paintLine(page1, font, BLANKS.originatingAgent, form.originatingAgent);
  paintLine(page1, font, BLANKS.originatingPhone, form.originatingPhone);
  paintLine(page1, font, BLANKS.originatingEmail, form.originatingEmail);
  paintLine(page1, font, BLANKS.receivingBrokerage, form.receivingBrokerage);
  paintLine(page1, font, BLANKS.receivingAgent, form.receivingAgent);
  paintLine(page1, font, BLANKS.receivingPhone, form.receivingPhone);
  paintLine(page1, font, BLANKS.receivingEmail, form.receivingEmail);
  paintLine(page1, font, BLANKS.opportunityId, form.opportunityId);
  paintLine(page1, font, BLANKS.clientName, form.clientName);
  paintLine(page1, font, BLANKS.clientPhone, form.clientPhone);
  paintLine(page1, font, BLANKS.clientEmail, form.clientEmail);
  paintLine(page1, font, BLANKS.termStart, shortUsDate(form.termStart), 9);
  paintLine(page1, font, BLANKS.termEnd, shortUsDate(form.termEnd), 9);

  if (form.feeKind === "percent") paintLine(page1, font, BLANKS.feePercent, form.feePercent.trim(), 10);
  if (form.feeKind === "flat") paintLine(page1, font, BLANKS.feeFlat, form.feeFlat.trim(), 9);

  for (const name of checkedBoxes(form)) paintX(page1, BOXES[name]);

  paintParagraph(page2, font, form.additionalTerms);
  paintLine(page2, font, BLANKS.governingLaw, form.governingLaw, 10);
  paintLine(page2, font, BLANKS.paymentTo, form.paymentTo, 8);

  // Brokerage names on the signature page identify the parties. By / Name / Title stay blank.
  paintLine(page3, font, BLANKS.originatingSignBrokerage, form.originatingBrokerage, 9);
  paintLine(page3, font, BLANKS.receivingSignBrokerage, form.receivingBrokerage, 9);

  doc.setTitle("eXp-to-eXp Agent Referral Agreement");
  return doc.save();
}

function paintLine(page: PDFPage, font: PDFFont, blank: LineBlank, raw: string, preferSize = 10) {
  const text = toWinAnsi(raw).trim();
  if (!text) return;
  const maxWidth = Math.max(8, blank.right - blank.x - 4);
  const fitted = fitText(font, text, preferSize, maxWidth);
  const bandTop = blank.top - 10.4;
  const bandBottom = blank.top + 3.2;
  page.drawRectangle({
    x: blank.x - 0.6,
    y: pdfBaseline(bandBottom),
    width: blank.right - blank.x + 1.2,
    height: bandBottom - bandTop,
    color: PAPER,
    borderWidth: 0,
  });
  page.drawText(fitted.text, {
    x: blank.x + 2,
    y: pdfBaseline(blank.top),
    size: fitted.size,
    font,
    color: INK,
  });
}

function paintParagraph(page: PDFPage, font: PDFFont, raw: string) {
  const text = toWinAnsi(raw).trim();
  if (!text) return;
  const box = ADDITIONAL_TERMS_BOX;
  const maxWidth = box.right - box.x;
  let size = 8;
  let leading = 10;
  let lines = wrapLines(font, text, size, maxWidth);
  while (size > 6.5 && box.top + lines.length * leading > box.bottom) {
    size -= 0.5;
    leading = size + 1.6;
    lines = wrapLines(font, text, size, maxWidth);
  }
  const maxLines = Math.max(1, Math.floor((box.bottom - box.top) / leading));
  const shown = lines.slice(0, maxLines);
  shown.forEach((line, i) => {
    page.drawText(line, {
      x: box.x,
      y: pdfBaseline(box.top + i * leading),
      size,
      font,
      color: INK,
    });
  });
}

function paintX(page: PDFPage, box: (typeof BOXES)[keyof typeof BOXES]) {
  const placed = pdfBox(box);
  const pad = 2.1;
  const x0 = placed.x + pad;
  const y0 = placed.y + pad;
  const x1 = placed.x + placed.size - pad;
  const y1 = placed.y + placed.size - pad;
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: 1.25, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: x0, y: y1 }, end: { x: x1, y: y0 }, thickness: 1.25, color: rgb(0, 0, 0) });
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number): { text: string; size: number } {
  let next = size;
  let value = text;
  while (next > 6.5 && font.widthOfTextAtSize(value, next) > maxWidth) next -= 0.25;
  if (font.widthOfTextAtSize(value, next) <= maxWidth) return { text: value, size: next };
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, next) > maxWidth) value = value.slice(0, -1).trimEnd();
  const clipped = value.length < text.length ? `${value}...` : value;
  return { text: clipped, size: next };
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
