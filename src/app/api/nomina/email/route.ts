import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendDesprendibleEmail } from "@/lib/nomina/email";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  pdfBase64: z.string().min(1),
  historialId: z.number().int().positive(),
  attachedFileBase64: z.string().nullable().optional(),
  filenamePdf: z.string().min(1),
  filenameAttached: z.string().optional(),
  nombrePersona: z.string().min(1),
});

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const sb = getSupabaseAdmin();

  try {
    const attachments: { filename: string; content: Buffer }[] = [
      { filename: data.filenamePdf, content: Buffer.from(data.pdfBase64, "base64") },
    ];
    if (data.attachedFileBase64) {
      attachments.push({
        filename: data.filenameAttached ?? "comprobante.pdf",
        content: Buffer.from(data.attachedFileBase64, "base64"),
      });
    }

    await sendDesprendibleEmail({
      to: data.to,
      subject: data.subject,
      html: data.htmlContent,
      attachments,
    });

    await sb
      .from("historial")
      .update({
        fecha_envio: new Date().toISOString(),
        estado: "Enviado",
        nombre_persona: data.nombrePersona,
      })
      .eq("id", data.historialId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando correo";
    await sb
      .from("historial")
      .update({ estado: "Fallido", nombre_persona: data.nombrePersona })
      .eq("id", data.historialId);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
