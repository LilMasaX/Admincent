import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfFieldValues = Record<string, string>;

export type PdfFieldDef = {
  key: string;
  page?: number;
  x: number;
  y: number;
  size?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
};

export async function fillPdfByPlacements(
  templateBytes: Uint8Array,
  fields: PdfFieldDef[],
  values: PdfFieldValues,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const f of fields) {
    const text = values[f.key];
    if (text == null || text === "") continue;
    const page = pages[f.page ?? 0];
    if (!page) continue;
    const size = f.size ?? 14;

    let x = f.x;
    if (f.align && f.align !== "left") {
      const w = font.widthOfTextAtSize(text, size);
      if (f.align === "center") x = f.x - w / 2;
      else if (f.align === "right") x = f.x - w;
    }

    page.drawText(text, { x, y: f.y, size, font, color: rgb(0, 0, 0) });
  }
  return pdf.save();
}

export async function fillPdfForm(
  templateBytes: Uint8Array,
  values: PdfFieldValues,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe?.(name) ?? form.getField(name);
    if (!field) continue;
    if ("setText" in field && typeof field.setText === "function") {
      (field as { setText: (v: string) => void }).setText(value);
    }
  }
  form.flatten();
  return pdf.save();
}

export async function pdfHasAcroForm(templateBytes: Uint8Array): Promise<boolean> {
  const pdf = await PDFDocument.load(templateBytes);
  try {
    const form = pdf.getForm();
    return form.getFields().length > 0;
  } catch {
    return false;
  }
}

export async function getPdfPageSizes(templateBytes: Uint8Array) {
  const pdf = await PDFDocument.load(templateBytes);
  return pdf.getPages().map((p) => ({ width: p.getWidth(), height: p.getHeight() }));
}
