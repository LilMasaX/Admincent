import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type DocxValues = Record<string, string | number | boolean>;

export function fillDocx(templateBytes: Uint8Array, values: DocxValues): Uint8Array {
  const zip = new PizZip(Buffer.from(templateBytes));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(values);
  return doc.getZip().generate({ type: "nodebuffer" });
}
