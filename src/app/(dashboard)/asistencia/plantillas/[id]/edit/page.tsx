import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  AsistenciaTemplateEditor,
  type AsistenciaField,
  type LogoRect,
} from "@/components/AsistenciaTemplateEditor";
import {
  AsistenciaAcroformMapEditor,
  type AcroformMapping,
} from "@/components/AsistenciaAcroformMapEditor";

export default async function EditAsistenciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;
  const sb = getSupabaseAdmin();
  const tpl = await sb
    .from("templates")
    .select(
      "id, name, storage_path, fields, page_sizes, logo_position, has_acroform, acroform_fields, acroform_field_map, owner_id, tipo",
    )
    .eq("id", id)
    .maybeSingle();
  if (tpl.error || !tpl.data) notFound();
  const data = tpl.data;
  if (data.owner_id !== userId || data.tipo !== "asistencia") notFound();

  const signed = await sb.storage
    .from("templates")
    .createSignedUrl(data.storage_path, 60 * 30);
  if (signed.error || !signed.data) {
    return <p className="text-sm text-red-400">No se pudo cargar el archivo de la plantilla.</p>;
  }

  const pageSizes =
    (data.page_sizes as Array<{ width: number; height: number }> | null) ?? [];

  const hasAcroform = !!data.has_acroform;
  const acroformFields = (data.acroform_fields as string[] | null) ?? [];
  const acroformMap = (data.acroform_field_map as AcroformMapping[] | null) ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
        {hasAcroform ? (
          <p className="text-sm text-[var(--color-muted)]">
            Plantilla con campos de formulario PDF. Asigna cada campo detectado al
            dato correspondiente del desprendible.
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Modo <strong>Texto</strong>: clic para colocar nombre / cédula / curso.
            Auto-ajusta el tamaño si el texto excede el ancho máximo. Modo{" "}
            <strong>Logo</strong>: arrastra un rectángulo donde irá el logo extra.
          </p>
        )}
      </header>

      {hasAcroform ? (
        <AsistenciaAcroformMapEditor
          templateId={data.id}
          pdfFieldNames={acroformFields}
          initialMap={acroformMap}
          pdfUrl={signed.data.signedUrl}
          pageSizes={pageSizes}
          initialLogo={(data.logo_position ?? null) as LogoRect}
        />
      ) : (
        <AsistenciaTemplateEditor
          templateId={data.id}
          pdfUrl={signed.data.signedUrl}
          initialFields={(data.fields ?? []) as AsistenciaField[]}
          initialLogo={(data.logo_position ?? null) as LogoRect}
          pageSizes={pageSizes}
        />
      )}
    </div>
  );
}
