import { readFile } from "fs/promises";
import { join } from "path";
import ExcelJS from "exceljs";
import { calculatePayment, type ConceptoItem } from "./payment";
import { officeToPdf } from "@/lib/cert/office-pdf";

export type TipoPersona = "trabajadores" | "instructores" | "proveedores";

export type DesprendiblePersona = {
  id: number | string;
  nombre: string;
  documento?: string;
  cargo?: string;
  salario?: number | string;
};

export type DesprendibleInput = {
  tipoPersona: TipoPersona;
  persona: DesprendiblePersona;
  fechaInicio: string;
  fechaFin: string;
  comprobante: string;
  devengados: ConceptoItem[];
  deducciones: ConceptoItem[];
  dbDevengados?: ConceptoItem[];
  dbDeducciones?: ConceptoItem[];
};

const TEMPLATE_PATH = join(process.cwd(), "src/lib/nomina/assets/desprendible_plantilla.xlsx");

const toNumber = (v: number | string | undefined | null) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Template layout (1-indexed):
//   D5: Periodo  D6: Comprobante  D7: Nombre  D8: Documento  D9: Cargo
//   Rows 12..14: items (A=concepto izq, B=valor izq, C=concepto der, D=valor der)
//   Row 15: B=total ingresos, D=total deducciones
//   Row 17: D=neto a pagar
const FIRST_ITEM_ROW = 12;
const TEMPLATE_ITEM_ROWS = 3; // rows 12, 13, 14 in the template
const TOTALS_ROW_OFFSET = TEMPLATE_ITEM_ROWS; // totals start at FIRST_ITEM_ROW + offset
const NETO_ROW_OFFSET = TOTALS_ROW_OFFSET + 2; // 2 rows below totals

export async function buildDesprendiblePdf(input: DesprendibleInput): Promise<Uint8Array> {
  const {
    persona,
    fechaInicio,
    fechaFin,
    comprobante,
    devengados,
    deducciones,
    dbDevengados = [],
    dbDeducciones = [],
  } = input;

  const allDevengados = [...dbDevengados, ...devengados].filter((d) => d.concepto?.trim());
  const allDeducciones = [...dbDeducciones, ...deducciones].filter((d) => d.concepto?.trim());

  const totalDevengado = allDevengados.reduce((s, i) => s + toNumber(i.valor), 0);
  const totalDeducciones = allDeducciones.reduce((s, i) => s + toNumber(i.valor), 0);
  const valorAPagar = calculatePayment(devengados, deducciones, dbDevengados, dbDeducciones);

  const templateBytes = await readFile(TEMPLATE_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes.buffer.slice(
    templateBytes.byteOffset,
    templateBytes.byteOffset + templateBytes.byteLength,
  ) as ArrayBuffer);

  const sheet = wb.worksheets[0];

  // Force landscape orientation so iLovePDF / LibreOffice render PDF horizontal.
  sheet.pageSetup = {
    ...sheet.pageSetup,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // Header fields
  sheet.getCell("D5").value = `${fechaInicio} – ${fechaFin}`;
  sheet.getCell("D6").value = comprobante;
  sheet.getCell("D7").value = persona.nombre || "";
  const docStr = persona.documento ?? "";
  sheet.getCell("D8").value = /^\d+$/.test(docStr) ? Number(docStr) : docStr;
  sheet.getCell("D9").value = persona.cargo || "";

  // Extend item rows if needed. Template has TEMPLATE_ITEM_ROWS rows; if we
  // need more, duplicate row FIRST_ITEM_ROW to keep its styling.
  const itemCount = Math.max(allDevengados.length, allDeducciones.length, 1);
  const extraRows = Math.max(0, itemCount - TEMPLATE_ITEM_ROWS);
  if (extraRows > 0) {
    sheet.duplicateRow(FIRST_ITEM_ROW, extraRows, true);
  }
  const totalsRow = FIRST_ITEM_ROW + Math.max(itemCount, TEMPLATE_ITEM_ROWS);
  const netoRow = totalsRow + 2;

  // Clear template sample data in item rows
  for (let i = 0; i < Math.max(itemCount, TEMPLATE_ITEM_ROWS); i++) {
    const r = sheet.getRow(FIRST_ITEM_ROW + i);
    r.getCell("A").value = null;
    r.getCell("B").value = null;
    r.getCell("C").value = null;
    r.getCell("D").value = null;
  }

  // Fill items
  for (let i = 0; i < allDevengados.length; i++) {
    const row = sheet.getRow(FIRST_ITEM_ROW + i);
    row.getCell("A").value = allDevengados[i].concepto;
    row.getCell("B").value = toNumber(allDevengados[i].valor);
  }
  for (let i = 0; i < allDeducciones.length; i++) {
    const row = sheet.getRow(FIRST_ITEM_ROW + i);
    row.getCell("C").value = allDeducciones[i].concepto;
    row.getCell("D").value = toNumber(allDeducciones[i].valor);
  }

  // Totals
  sheet.getCell(`B${totalsRow}`).value = totalDevengado;
  sheet.getCell(`D${totalsRow}`).value = totalDeducciones;

  // Neto a pagar
  sheet.getCell(`D${netoRow}`).value = valorAPagar;

  const xlsxBuf = await wb.xlsx.writeBuffer();
  const xlsxBytes = new Uint8Array(xlsxBuf as ArrayBuffer);

  const pdf = await officeToPdf(xlsxBytes, "desprendible.xlsx");
  if (!pdf) {
    throw new Error(
      "No se pudo convertir XLSX a PDF. Configura ILOVEPDF_PUBLIC_KEY o instala LibreOffice.",
    );
  }
  return pdf;
}
