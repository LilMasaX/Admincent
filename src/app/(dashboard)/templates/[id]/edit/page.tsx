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

  const { id } = await params;
  const sb = getSupabaseAdmin();
  const tpl = await sb
    .from("templates")
    .select("id, name, kind, storage_path, fields, page_sizes, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (tpl.error || !tpl.data) notFound();
  if (tpl.data.owner_id !== session.user.id) notFound();
  if (tpl.data.kind !== "pdf") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">{tpl.data.name}</h1>
        <p className="mt-3 text-sm text-neutral-600">
          DOCX templates use <code>{"{{placeholder}}"}</code> tags inside the document — no visual
          editor needed.
        </p>
      </main>
    );
  }

  const signed = await sb.storage
    .from("templates")
    .createSignedUrl(tpl.data.storage_path, 60 * 30);
  if (signed.error || !signed.data) {
    return <main className="p-8">Failed to load template file.</main>;
  }

  const pageSizes =
    (tpl.data.page_sizes as Array<{ width: number; height: number }> | null) ?? [];

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{tpl.data.name}</h1>
        <p className="text-sm text-neutral-600">
          Click on the PDF to place each field. Save when done. Coordinates are PDF points
          (origin bottom-left).
        </p>
      </header>
      <TemplateEditor
        templateId={tpl.data.id}
        pdfUrl={signed.data.signedUrl}
        initialFields={(tpl.data.fields ?? []) as PdfFieldDefStored[]}
        pageSizes={pageSizes}
      />
    </main>
  );
}
