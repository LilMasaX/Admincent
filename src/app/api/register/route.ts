import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  const sb = getSupabaseAdmin();
  const exists = await sb.from("app_users").select("id").eq("email", email).maybeSingle();
  if (exists.data) return NextResponse.json({ error: "email taken" }, { status: 409 });

  const password_hash = await bcrypt.hash(password, 10);
  const ins = await sb
    .from("app_users")
    .insert({ email, password_hash, name: name ?? null })
    .select("id, email")
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ user: ins.data });
}
