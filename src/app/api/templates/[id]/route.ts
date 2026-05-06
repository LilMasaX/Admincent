import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const sb = getSupabaseAdmin();
  const tpl = await sb
    .from("templates")
    .select("id, name, kind, storage_path, fields, page_sizes, has_acroform, created_at, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (tpl.error || !tpl.data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (tpl.data.owner_id !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ template: tpl.data });
}
