import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
    .select("id, owner_id")
    .eq("id", templateId)
    .maybeSingle();
  if (tpl.error || !tpl.data) return NextResponse.json({ error: "template not found" }, { status: 404 });
  if (tpl.data.owner_id !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // No storage upload — certificate is regenerated on-demand from values.
  const ins = await sb
    .from("certificates")
    .insert({
      owner_id: session.user.id,
      template_id: templateId,
      storage_path: null,
      values,
    })
    .select()
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  return NextResponse.json({ certificate: ins.data });
}
