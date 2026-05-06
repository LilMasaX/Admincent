import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fillDocx,
  fillPdfByPlacements,
  fillPdfForm,
  type PdfFieldDef,
} from "@/lib/cert";

const bodySchema = z.object({
  templateId: z.string().uuid(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { templateId, values } = parsed.data;

  const sb = getSupabaseAdmin();
  const tpl = await sb
    .from("templates")
    .select("id, kind, storage_path, owner_id, fields, has_acroform")
    .eq("id", templateId)
    .maybeSingle();
  if (tpl.error || !tpl.data) return NextResponse.json({ error: "template not found" }, { status: 404 });
  if (tpl.data.owner_id !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dl = await sb.storage.from("templates").download(tpl.data.storage_path);
  if (dl.error || !dl.data) return NextResponse.json({ error: "download failed" }, { status: 500 });
  const templateBytes = new Uint8Array(await dl.data.arrayBuffer());

  let outBytes: Uint8Array;
  let mime: string;
  let ext: string;
  if (tpl.data.kind === "pdf") {
    const stringValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) stringValues[k] = String(v);

    const fields = (tpl.data.fields ?? []) as PdfFieldDef[];
    if (fields.length > 0) {
      outBytes = await fillPdfByPlacements(templateBytes, fields, stringValues);
    } else if (tpl.data.has_acroform) {
      outBytes = await fillPdfForm(templateBytes, stringValues);
    } else {
      return NextResponse.json(
        { error: "PDF template has no field placements. PATCH /api/templates with fields[]." },
        { status: 400 },
      );
    }
    mime = "application/pdf";
    ext = "pdf";
  } else {
    outBytes = fillDocx(templateBytes, values);
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    ext = "docx";
  }

  const outPath = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from("certificates").upload(outPath, outBytes, {
    contentType: mime,
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const ins = await sb
    .from("certificates")
    .insert({
      owner_id: session.user.id,
      template_id: templateId,
      storage_path: outPath,
      values,
    })
    .select()
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  return NextResponse.json({ certificate: ins.data });
}
