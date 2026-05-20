import {
  fillDocx,
  fillDocxAsPdf,
  fillPdfByPlacements,
  fillPdfForm,
  type PdfFieldDef,
} from "./index";

export type CertificateTemplate = {
  kind: "pdf" | "docx";
  fields: unknown;
  has_acroform: boolean;
};

export type RenderedCertificate = {
  bytes: Uint8Array;
  mime: string;
  ext: "pdf" | "docx";
};

export type RenderError = { error: string; status: number };

export async function renderCertificate(
  templateBytes: Uint8Array,
  template: CertificateTemplate,
  values: Record<string, string | number | boolean>,
): Promise<RenderedCertificate | RenderError> {
  if (template.kind === "pdf") {
    const stringValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) stringValues[k] = String(v);

    const fields = (template.fields ?? []) as PdfFieldDef[];
    let bytes: Uint8Array;
    if (fields.length > 0) {
      bytes = await fillPdfByPlacements(templateBytes, fields, stringValues);
    } else if (template.has_acroform) {
      bytes = await fillPdfForm(templateBytes, stringValues);
    } else {
      return { error: "PDF template has no field placements or AcroForm.", status: 400 };
    }
    return { bytes, mime: "application/pdf", ext: "pdf" };
  }

  const pdfBytes = await fillDocxAsPdf(templateBytes, values);
  if (pdfBytes) return { bytes: pdfBytes, mime: "application/pdf", ext: "pdf" };

  return {
    bytes: fillDocx(templateBytes, values),
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: "docx",
  };
}
