import { exec } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { promisify } from "util";
import PizZip from "pizzip";

const execAsync = promisify(exec);

const MIME_BY_EXT: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
};

/**
 * Converts an Office file (Word/Excel/PowerPoint) to PDF via iLovePDF API.
 * Returns null if not configured or conversion fails — caller should fall back.
 */
export async function convertViaIlovePdf(
  bytes: Uint8Array,
  filename: string,
): Promise<Uint8Array | null> {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  if (!publicKey) return null;

  const ext = extname(filename).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  try {
    const authRes = await fetch("https://api.ilovepdf.com/v1/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    });
    if (!authRes.ok) return null;
    const { token } = (await authRes.json()) as { token: string };
    const bearer = { Authorization: `Bearer ${token}` };

    const startRes = await fetch("https://api.ilovepdf.com/v1/start/officepdf", {
      headers: bearer,
    });
    if (!startRes.ok) return null;
    const { server, task } = (await startRes.json()) as { server: string; task: string };
    const host = server.includes(".") ? server : `${server}.ilovepdf.com`;
    const base = `https://${host}/v1`;

    const form = new FormData();
    form.append("task", task);
    form.append(
      "file",
      new Blob(
        [
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: mime },
      ),
      filename,
    );
    const uploadRes = await fetch(`${base}/upload`, {
      method: "POST",
      headers: bearer,
      body: form,
    });
    if (!uploadRes.ok) return null;
    const { server_filename } = (await uploadRes.json()) as { server_filename: string };

    const processRes = await fetch(`${base}/process`, {
      method: "POST",
      headers: { ...bearer, "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        tool: "officepdf",
        files: [{ server_filename, filename }],
      }),
    });
    if (!processRes.ok) return null;

    const dlRes = await fetch(`${base}/download/${task}`, { headers: bearer });
    if (!dlRes.ok) return null;

    const out = new Uint8Array(await dlRes.arrayBuffer());

    // Single file → raw PDF; batch → ZIP containing the PDF
    if (out[0] === 0x50 && out[1] === 0x4b) {
      const zip = new PizZip(Buffer.from(out));
      const pdfEntry = Object.values(zip.files).find(
        (f) => !f.dir && f.name.endsWith(".pdf"),
      );
      if (pdfEntry) return new Uint8Array(pdfEntry.asArrayBuffer() as ArrayBuffer);
      return null;
    }
    return out;
  } catch (err) {
    console.error("[iLovePDF] conversion failed:", err);
    return null;
  }
}

/** Converts an Office file to PDF via local LibreOffice (`soffice` in PATH). */
export async function convertViaLibreOffice(
  bytes: Uint8Array,
  filename: string,
): Promise<Uint8Array | null> {
  const id = randomUUID();
  const dir = tmpdir();
  const inPath = join(dir, `${id}-${filename}`);
  const ext = extname(filename).slice(1).toLowerCase();
  const pdfPath = join(dir, `${id}-${filename.replace(new RegExp(`\\.${ext}$`), ".pdf")}`);
  try {
    await writeFile(inPath, bytes);
    await execAsync(
      `soffice --headless --convert-to pdf --outdir "${dir}" "${inPath}"`,
      { timeout: 30_000 },
    );
    return new Uint8Array(await readFile(pdfPath));
  } catch {
    return null;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}

/** Tries iLovePDF first, then LibreOffice. Returns null if both fail. */
export async function officeToPdf(
  bytes: Uint8Array,
  filename: string,
): Promise<Uint8Array | null> {
  return (
    (await convertViaIlovePdf(bytes, filename)) ??
    (await convertViaLibreOffice(bytes, filename))
  );
}
