import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { TemplateEditor } from "@/components/TemplateEditor";
import type { PdfFieldDefStored } from "@/lib/cert";

export default async function EditTemplatePage({
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
    .select("id, name, kind, storage_path, fields, page_sizes, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (tpl.error || !tpl.data) notFound();
  const data = tpl.data;
  if (data.owner_id !== userId) notFound();

  if (data.kind !== "pdf") {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Las plantillas DOCX usan etiquetas{" "}
          <code className="rounded bg-[var(--color-surface-2)] px-1">{"{{clave}}"}</code> dentro
          del documento. No requieren editor visual.
        </p>
      </div>
    );
  }

  const signed = await sb.storage
    .from("templates")
    .createSignedUrl(data.storage_path, 60 * 30);
  if (signed.error || !signed.data) {
    return <p className="text-sm text-red-400">No se pudo cargar el archivo de la plantilla.</p>;
  }

  const pageSizes =
    (data.page_sizes as Array<{ width: number; height: number }> | null) ?? [];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Haz clic sobre el PDF para colocar cada campo. Coordenadas en puntos PDF (origen
          inferior-izquierdo).
        </p>
      </header>
      <TemplateEditor
        templateId={data.id}
        pdfUrl={signed.data.signedUrl}
        initialFields={(data.fields ?? []) as PdfFieldDefStored[]}
        pageSizes={pageSizes}
      />
    </div>
  );
}
