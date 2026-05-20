import { NextResponse } from "next/server";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildDesprendiblePdf } from "@/lib/nomina/desprendible-pdf";

export async function GET(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("historial")
    .select("payload, comprobante, nombre_persona")
    .eq("id", id)
    .single();

  if (error || !data?.payload) {
    return NextResponse.json({ error: "Registro sin datos para regenerar" }, { status: 404 });
  }

  const p = data.payload as {
    tipoPersona: "trabajadores" | "instructores" | "proveedores";
    persona: { id: string | number; nombre: string; documento?: string; cargo?: string; salario?: string | number };
    fechaInicio: string;
    fechaFin: string;
    comprobante: string;
    devengados: { concepto: string; valor: string | number }[];
    deducciones: { concepto: string; valor: string | number }[];
    dbDevengados: { concepto: string; valor: string | number }[];
    dbDeducciones: { concepto: string; valor: string | number }[];
  };

  const pdfBytes = await buildDesprendiblePdf({
    tipoPersona: p.tipoPersona,
    persona: p.persona,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    comprobante: p.comprobante ?? `${new Date().getFullYear()}-${data.comprobante}`,
    devengados: p.devengados ?? [],
    deducciones: p.deducciones ?? [],
    dbDevengados: p.dbDevengados ?? [],
    dbDeducciones: p.dbDeducciones ?? [],
  });

  return NextResponse.json({
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    comprobante: p.comprobante,
    nombre: data.nombre_persona,
  });
}
