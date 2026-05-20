"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileSignature, FileText, Trash2 } from "lucide-react";

type Template = {
  id: string;
  name: string;
  kind: "pdf" | "docx";
  fields: unknown[];
  has_acroform: boolean;
  created_at: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/templates?tipo=certificado")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
  }, []);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setUploading(true);
    try {
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error subiendo plantilla");
        return;
      }
      toast.success("Plantilla subida");
      setTemplates((prev) => [data.template, ...prev]);
      form.reset();
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar plantilla "${name}"? Los certificados generados con ella también se borrarán.`)) {
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Error eliminando plantilla");
        return;
      }
      toast.success("Plantilla eliminada");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Plantillas</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Sube un PDF (con campos o sin ellos) o un DOCX con marcadores{" "}
          <code className="rounded bg-[var(--color-surface-2)] px-1">{"{{clave}}"}</code> para
          generar certificados.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Subir nueva plantilla</h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={upload}
        >
          <input
            name="name"
            required
            placeholder="Nombre de la plantilla"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.docx"
            className="text-sm text-[var(--color-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <button
            disabled={uploading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Subir"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tus plantillas</h2>
        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            Aún no has subido plantillas.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-[var(--color-accent)]/15 p-2 text-[var(--color-accent)]">
                    {t.kind === "pdf" ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <FileSignature className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {t.kind.toUpperCase()} ·{" "}
                      {t.kind === "pdf"
                        ? Array.isArray(t.fields) && t.fields.length > 0
                          ? `${t.fields.length} campos`
                          : t.has_acroform
                            ? "AcroForm"
                            : "Sin campos"
                        : "Marcadores DOCX"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.kind === "pdf" && (
                    <Link
                      href={`/templates/${t.id}/edit`}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)]"
                    >
                      Editar
                    </Link>
                  )}
                  <button
                    onClick={() => remove(t.id, t.name)}
                    disabled={deleting === t.id}
                    className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    title="Eliminar plantilla"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
