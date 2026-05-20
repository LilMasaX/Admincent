import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFTextField, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type FieldKey =
  | "nombre"
  | "cedula"
  | "curso"
  | "horas"
  | "instructor"
  | "dia"
  | "mes"
  | "anio";

export type AsistenciaFieldDef = {
  key: FieldKey;
  page?: number;
  x: number;
  y: number;
  size?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  autoShrink?: boolean;
  monthFormat?: "numeric" | "text";
};

export type AcroformFieldMapping = {
  pdfField: string;
  key: FieldKey;
  monthFormat?: "numeric" | "text";
};

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type LogoPosition = {
  page?: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AsistenciaValues = {
  nombre: string;
  cedula?: string;
  curso: string;
  horas?: string;
  instructor?: string;
  dia?: number;
  mes?: number;
  anio?: number;
};

function valueForKey(
  key: FieldKey,
  v: AsistenciaValues,
  monthFormat?: "numeric" | "text",
): string {
  switch (key) {
    case "nombre":
      return v.nombre ?? "";
    case "cedula":
      return v.cedula ?? "";
    case "curso":
      return v.curso ?? "";
    case "horas":
      return v.horas ?? "";
    case "instructor":
      return v.instructor ?? "";
    case "dia":
      return v.dia != null ? String(v.dia).padStart(2, "0") : "";
    case "mes":
      if (v.mes == null) return "";
      if (monthFormat === "text") return MESES_ES[v.mes - 1] ?? "";
      return String(v.mes).padStart(2, "0");
    case "anio":
      return v.anio != null ? String(v.anio) : "";
  }
}

function valueForField(f: AsistenciaFieldDef, v: AsistenciaValues): string {
  return valueForKey(f.key, v, f.monthFormat);
}

let cursiveFontBytesCache: Uint8Array | null = null;
async function loadCursiveFontBytes(): Promise<Uint8Array> {
  if (cursiveFontBytesCache) return cursiveFontBytesCache;
  const p = path.join(process.cwd(), "src/lib/asistencia/fonts/GreatVibes-Regular.ttf");
  const buf = await fs.readFile(p);
  cursiveFontBytesCache = new Uint8Array(buf);
  return cursiveFontBytesCache;
}

function fitFontSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  startSize: number,
  minSize = 8,
): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

async function drawLogoOverlay(
  pdf: PDFDocument,
  logoPosition: LogoPosition,
  logoBytes: Uint8Array,
  logoMime: string,
) {
  const pages = pdf.getPages();
  const page = pages[logoPosition.page ?? 0];
  if (!page) return;
  const img =
    logoMime === "image/png"
      ? await pdf.embedPng(logoBytes)
      : await pdf.embedJpg(logoBytes);
  const { x, y, width, height } = logoPosition;
  const ratio = img.width / img.height;
  let drawW = width;
  let drawH = height;
  if (drawW / drawH > ratio) drawW = drawH * ratio;
  else drawH = drawW / ratio;
  const cx = x + (width - drawW) / 2;
  const cy = y + (height - drawH) / 2;
  page.drawImage(img, { x: cx, y: cy, width: drawW, height: drawH });
}

export async function renderAsistenciaPdf(opts: {
  templateBytes: Uint8Array;
  fields: AsistenciaFieldDef[];
  values: AsistenciaValues;
  logoPosition?: LogoPosition | null;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
  acroformMap?: AcroformFieldMapping[] | null;
  useAcroform?: boolean;
}): Promise<Uint8Array> {
  if (opts.useAcroform && opts.acroformMap && opts.acroformMap.length > 0) {
    return renderAsistenciaPdfAcroform(opts);
  }
  return renderAsistenciaPdfOverlay(opts);
}

async function renderAsistenciaPdfOverlay(opts: {
  templateBytes: Uint8Array;
  fields: AsistenciaFieldDef[];
  values: AsistenciaValues;
  logoPosition?: LogoPosition | null;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(opts.templateBytes);
  pdf.registerFontkit(fontkit);

  const baseFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const needsCursive = opts.fields.some(
    (f) => f.key === "instructor" && opts.values.instructor,
  );
  const cursiveFont = needsCursive
    ? await pdf.embedFont(await loadCursiveFontBytes(), { subset: true })
    : null;

  const pages = pdf.getPages();

  for (const f of opts.fields) {
    const text = valueForField(f, opts.values);
    if (!text) continue;
    const page = pages[f.page ?? 0];
    if (!page) continue;

    const font = f.key === "instructor" && cursiveFont ? cursiveFont : baseFont;
    const startSize = f.size ?? (f.key === "instructor" ? 32 : 18);
    const size =
      f.autoShrink && f.maxWidth
        ? fitFontSize(text, font, f.maxWidth, startSize)
        : startSize;

    let x = f.x;
    if (f.align && f.align !== "left") {
      const w = font.widthOfTextAtSize(text, size);
      if (f.align === "center") x = f.x - w / 2;
      else if (f.align === "right") x = f.x - w;
    }

    page.drawText(text, { x, y: f.y, size, font, color: rgb(0, 0, 0) });
  }

  if (opts.logoPosition && opts.logoBytes && opts.logoMime) {
    await drawLogoOverlay(pdf, opts.logoPosition, opts.logoBytes, opts.logoMime);
  }

  return pdf.save();
}

async function renderAsistenciaPdfAcroform(opts: {
  templateBytes: Uint8Array;
  values: AsistenciaValues;
  acroformMap?: AcroformFieldMapping[] | null;
  logoPosition?: LogoPosition | null;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(opts.templateBytes);
  pdf.registerFontkit(fontkit);

  const form = pdf.getForm();
  const map = opts.acroformMap ?? [];

  const needsCursive = map.some(
    (m) => m.key === "instructor" && opts.values.instructor,
  );
  const cursiveFont = needsCursive
    ? await pdf.embedFont(await loadCursiveFontBytes(), { subset: true })
    : null;

  for (const m of map) {
    const text = valueForKey(m.key, opts.values, m.monthFormat);
    if (!text) continue;
    const field = form.getFieldMaybe?.(m.pdfField) ?? null;
    if (!field || !(field instanceof PDFTextField)) continue;
    field.setText(text);
    if (m.key === "instructor" && cursiveFont) {
      try {
        field.updateAppearances(cursiveFont);
      } catch {
        // Fall back to default appearance if font update fails.
      }
    }
  }

  if (opts.logoPosition && opts.logoBytes && opts.logoMime) {
    await drawLogoOverlay(pdf, opts.logoPosition, opts.logoBytes, opts.logoMime);
  }

  form.flatten();
  return pdf.save();
}
