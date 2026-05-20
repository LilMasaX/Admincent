import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("historial")
    .select(
      "id, persona_id, tipo_persona, nombre_persona, fecha_generacion, fecha_envio, estado, persona_eliminada, comprobante, payload",
    )
    .eq("tipo_documento", "desprendible")
    .order("fecha_generacion", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (data ?? []).map((r) => ({
      id: r.id,
      persona_id: r.persona_id,
      tipo_persona: r.tipo_persona,
      nombre: r.nombre_persona,
      fecha_generacion: r.fecha_generacion,
      fecha_envio: r.fecha_envio,
      estado: r.estado,
      eliminado: !!r.persona_eliminada,
      comprobante: r.comprobante,
      has_payload: !!r.payload,
    })),
  );
}
