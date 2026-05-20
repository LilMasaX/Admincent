import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/nomina/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildDesprendiblePdf } from "@/lib/nomina/desprendible-pdf";
import { nextComprobanteNumber } from "@/lib/nomina/comprobante";

const conceptoSchema = z.object({
  concepto: z.string(),
  valor: z.union([z.string(), z.number()]),
});

const bodySchema = z.object({
  tipoPersona: z.enum(["trabajadores", "instructores", "proveedores"]),
  persona: z.object({
    id: z.union([z.string(), z.number()]),
    nombre: z.string().min(1),
    documento: z.string().optional(),
    cargo: z.string().optional(),
    salario: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
  }),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  devengados: z.array(conceptoSchema).default([]),
  deducciones: z.array(conceptoSchema).default([]),
  dbDevengados: z.array(conceptoSchema).default([]),
  dbDeducciones: z.array(conceptoSchema).default([]),
});

export async function POST(req: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const number = await nextComprobanteNumber();
    const comprobante = `${new Date().getFullYear()}-${number}`;

    const personaForPdf = {
      id: data.persona.id,
      nombre: data.persona.nombre,
      documento: data.persona.documento,
      cargo: data.persona.cargo,
      salario: data.persona.salario,
    };

    const pdfBytes = await buildDesprendiblePdf({
      tipoPersona: data.tipoPersona,
      persona: personaForPdf,
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      comprobante,
      devengados: data.devengados,
      deducciones: data.deducciones,
      dbDevengados: data.dbDevengados,
      dbDeducciones: data.dbDeducciones,
    });

    const payload = {
      tipoPersona: data.tipoPersona,
      persona: { ...personaForPdf, email: data.persona.email },
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      comprobante,
      devengados: data.devengados,
      deducciones: data.deducciones,
      dbDevengados: data.dbDevengados,
      dbDeducciones: data.dbDeducciones,
    };

    const sb = getSupabaseAdmin();
    const personaIdNum = Number(data.persona.id);
    const ins = await sb
      .from("historial")
      .insert({
        tipo_documento: "desprendible",
        persona_id: Number.isFinite(personaIdNum) ? personaIdNum : 0,
        tipo_persona: data.tipoPersona,
        nombre_persona: data.persona.nombre,
        comprobante: number,
        estado: "Generado",
        payload,
      })
      .select("id")
      .single();
    if (ins.error) {
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }

    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    return NextResponse.json({
      pdfBase64,
      historialId: ins.data.id,
      comprobante,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error generando desprendible";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
