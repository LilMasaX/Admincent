import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const postSchema = z.object({
  trabajadorId: z.coerce.number().int().positive(),
  concepto: z.string().min(1),
  valor: z.coerce.number(),
});

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;
  const url = new URL(req.url);
  const trabajadorId = Number(url.searchParams.get("trabajadorId"));
  if (!Number.isFinite(trabajadorId)) {
    return NextResponse.json({ error: "trabajadorId requerido" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deducciones")
    .select("*")
    .eq("trabajadores_id", trabajadorId)
    .order("id", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;
  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("deducciones")
    .insert({
      trabajadores_id: parsed.data.trabajadorId,
      concepto: parsed.data.concepto,
      valor: parsed.data.valor,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
