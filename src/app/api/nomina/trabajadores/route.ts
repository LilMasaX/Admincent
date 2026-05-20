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

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("trabajadores")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;
  const json = await req.json().catch(() => null);
  const parsed = trabajadorSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("trabajadores")
    .insert(parsed.data)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Documento o email ya existen" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
