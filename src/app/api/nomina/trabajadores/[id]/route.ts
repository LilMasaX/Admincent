import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const trabajadorSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  documento: z.string().min(1),
  telefono: z.string().min(1),
  cargo: z.string().min(1),
  salario: z.coerce.number().nonnegative(),
  numero_cuenta: z.string().min(1),
  tipo_cuenta: z.enum(["ahorros", "corriente"]),
  banco: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;
  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("trabajadores").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;
  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const json = await req.json().catch(() => null);
  const parsed = trabajadorSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("trabajadores")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Documento o email ya existen" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { response } = await requireSession();
  if (response) return response;
  const id = await parseId(ctx);
  if (id == null) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("trabajadores").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
