import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

// Builds the downloadable lease-agreement PDF - both the sent (unsigned)
// version and, once accepted, the signed record with the drawn signature
// and the integrity metadata captured at signing time (see
// app/api/tenant/lease/route.ts for how signedHash is computed). This is
// the paper trail behind the in-app "e-signing" flow: not a certified
// e-signature service, but a self-contained, tamper-evident record of
// exactly what was shown and who accepted it.
export interface LeasePdfData {
  tenantName: string;
  unitLabel?: string | null;
  monthlyRent?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  termsText: string;
  status: string;
  acceptedFullName?: string | null;
  acceptedAt?: string | null;
  signatureDataUrl?: string | null;
  signedIp?: string | null;
  signedUserAgent?: string | null;
  signedHash?: string | null;
  createdAt?: string | null;
}

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function wrapParagraph(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateLeasePdf(data: LeasePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawLine(text: string, opts: { size?: number; useBold?: boolean; color?: [number, number, number]; gapAfter?: number } = {}) {
    const size = opts.size ?? 10;
    const useFont = opts.useBold ? bold : font;
    const gap = opts.gapAfter ?? size + 5;
    ensureSpace(gap);
    const color = opts.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0.13, 0.13, 0.15);
    page.drawText(text, { x: MARGIN, y, size, font: useFont, color });
    y -= gap;
  }

  function drawParagraphBlock(text: string, size = 10, gap = size + 4) {
    const paragraphs = text.split("\n");
    for (const para of paragraphs) {
      if (para.trim() === "") {
        ensureSpace(gap);
        y -= gap;
        continue;
      }
      const lines = wrapParagraph(para, font, size, CONTENT_WIDTH);
      for (const line of lines) {
        drawLine(line, { size, gapAfter: gap });
      }
    }
  }

  // Header
  drawLine("MANAGIKA HOMES", { size: 20, useBold: true, gapAfter: 26 });
  drawLine("Residential Lease Agreement", { size: 13, useBold: true, color: [0.35, 0.35, 0.4], gapAfter: 22 });

  drawLine(`Tenant: ${data.tenantName}`, { size: 10.5 });
  if (data.unitLabel) drawLine(`Unit: ${data.unitLabel}`, { size: 10.5 });
  if (data.monthlyRent) drawLine(`Monthly rent: KSh ${Number(data.monthlyRent).toLocaleString()}`, { size: 10.5 });
  drawLine(`Lease period: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}`, { size: 10.5 });
  drawLine(`Document status: ${data.status === "accepted" ? "Signed and accepted" : "Awaiting signature"}`, { size: 10.5, gapAfter: 20 });

  drawLine("Terms and Conditions", { size: 12.5, useBold: true, gapAfter: 18 });
  drawParagraphBlock(data.termsText, 9.5, 13.5);

  // Signature section
  ensureSpace(140);
  y -= 10;
  drawLine("Tenant Acceptance", { size: 12.5, useBold: true, gapAfter: 18 });

  if (data.status === "accepted") {
    drawLine(`Accepted by (typed name): ${data.acceptedFullName || "—"}`, { size: 10 });
    drawLine(`Accepted at: ${formatDateTime(data.acceptedAt)}`, { size: 10, gapAfter: 12 });

    if (data.signatureDataUrl && data.signatureDataUrl.startsWith("data:image/png;base64,")) {
      try {
        const base64 = data.signatureDataUrl.split(",")[1] || "";
        const imageBytes = Buffer.from(base64, "base64");
        const pngImage = await pdfDoc.embedPng(imageBytes);
        const dims = pngImage.scaleToFit(220, 90);
        ensureSpace(dims.height + 20);
        page.drawRectangle({ x: MARGIN, y: y - dims.height - 6, width: 240, height: dims.height + 12, borderColor: rgb(0.8, 0.8, 0.82), borderWidth: 1 });
        page.drawImage(pngImage, { x: MARGIN + 8, y: y - dims.height, width: dims.width, height: dims.height });
        y -= dims.height + 22;
        drawLine("Signature captured above", { size: 8, color: [0.5, 0.5, 0.55], gapAfter: 18 });
      } catch {
        drawLine("(Signature image could not be rendered)", { size: 9, color: [0.6, 0.2, 0.2], gapAfter: 16 });
      }
    }

    drawLine("Signing Integrity Record", { size: 11, useBold: true, gapAfter: 16 });
    drawLine(`IP address at signing: ${data.signedIp || "not captured"}`, { size: 8.5, color: [0.4, 0.4, 0.45] });
    const ua = data.signedUserAgent || "not captured";
    const uaLines = wrapParagraph(`Device/browser: ${ua}`, font, 8.5, CONTENT_WIDTH);
    for (const line of uaLines) drawLine(line, { size: 8.5, color: [0.4, 0.4, 0.45], gapAfter: 12 });
    if (data.signedHash) {
      drawLine("Document fingerprint (SHA-256 of the exact terms signed):", { size: 8.5, color: [0.4, 0.4, 0.45] });
      drawLine(data.signedHash, { size: 8, color: [0.4, 0.4, 0.45], gapAfter: 14 });
    }
    drawParagraphBlock(
      "This fingerprint is a one-way hash of the terms, rent, and dates exactly as they appeared when the tenant signed. Re-hashing this document's terms and comparing it to the fingerprint above confirms the terms have not been altered since signing. This is a self-issued digital record, not a certified e-signature from a licensed provider - it is offered as strong supporting evidence of consent, alongside any signed paper lease.",
      8,
      11.5
    );
  } else {
    drawLine("Not yet signed by the tenant.", { size: 10, color: [0.6, 0.45, 0.1] });
  }

  drawLine(`Generated ${formatDateTime(new Date().toISOString())} by Managika Homes`, { size: 7.5, color: [0.6, 0.6, 0.63], gapAfter: 10 });

  return pdfDoc.save();
}
