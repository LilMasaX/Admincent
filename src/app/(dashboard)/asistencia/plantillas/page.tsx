"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Trash2, Upload } from "lucide-react";
import { toast } from "react-hot-toast";

type Template = {
  id: string;
  name: string;
  fields: { key: string }[];
  logo_position: unknown;
  has_acroform: boolean;
  acroform_fields: string[] | null;
  acroform_field_map: { pdfField: string; key: string }[] | null;
  created_at: string;
};

export default function AsistenciaPlantillasPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadTemplates() {
    setLoading(true);
    fetch("/api/asistencia/templates")
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.templates) && setTemplates(d.templates))
      .catch(() => toast.error("No se pudieron cargar plantillas"))
      .finally(() => setLoading(false));
  }

  useEffect(loadTemplates, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !file) {
      toast.error("Completa nombre y selecciona un PDF");
      return;
    }
    setUploading(true);
    const id = toast.loading("Subiendo plantilla…");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("file", file);
      const res = await fetch("/api/asistencia/templates", { method: "POST", body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error al subir");
      toast.success("Subida correctamente", { id });
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.push(`/asistencia/plantillas/${j.template.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar plantilla "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    const tid = toast.loading("Eliminando…");
    try {
      const res = await fetch(`/api/asistencia/templates/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Error eliminando");
      toast.success("Plantilla eliminada", { id: tid });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id: tid });
    } finally {
      setDeleting(null);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plantillas de asistencia</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Sube un PDF de diploma con campos de formulario (AcroForm). La app
            rellena cada campo por nombre y solo usa coordenadas para el logo.
          </p>
        </div>
        <Link
          href="/asistencia"
          className="shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
        >
          Ir al generador →
        </Link>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-3 text-lg font-semibold">
          Cómo añadir los campos con PDF24 Tools (gratis)
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--color-muted)]">
          <li>
            Descarga{" "}
            <a
              href="https://tools.pdf24.org/es/creator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] underline"
            >
              PDF24 Creator
            </a>{" "}
            (Windows, gratis) e instálalo. También sirve la herramienta web{" "}
            <a
              href="https://tools.pdf24.org/es/edit-pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] underline"
            >
              Editar PDF
            </a>
            .
          </li>
          <li>Abre tu PDF de diploma en PDF24 Creator.</li>
          <li>
            En la barra de herramientas activa <strong>Formulario</strong> →{" "}
            <strong>Insertar campo de texto</strong>.
          </li>
          <li>
            Dibuja un campo de texto sobre cada zona del diploma donde irá un dato.
          </li>
          <li>
            Clic derecho en cada campo → <strong>Propiedades</strong> → pestaña{" "}
            <strong>General</strong> → <strong>Nombre</strong>. Usa exactamente uno
            de estos nombres (en minúsculas):
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "nombre",
                "cedula",
                "curso",
                "horas",
                "instructor",
                "dia",
                "dia_inicio",
                "dia_fin",
                "mes",
                "anio",
                "dia_expedicion",
                "mes_expedicion",
                "anio_expedicion",
                "adicional",
              ].map((k) => (
                <code
                  key={k}
                  className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs text-[var(--color-text)]"
                >
                  {k}
                </code>
              ))}
            </div>
          </li>
          <li>
            Ajusta tamaño de letra y alineación dentro de las{" "}
            <strong>Propiedades</strong> del campo (pestaña <strong>Apariencia</strong>).
          </li>
          <li>Guarda como PDF y súbelo aquí abajo.</li>
          <li>
            En el editor podrás revisar el mapeo automático y arrastrar el área del
            logo extra (opcional).
          </li>
        </ol>
        <p className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted)]">
          Tip: para fechas tipo &quot;del 19 al 25 de 12 del 2026&quot; usa los
          campos{" "}
          <code className="rounded bg-[var(--color-surface)] px-1">dia_inicio</code>,{" "}
          <code className="rounded bg-[var(--color-surface)] px-1">dia_fin</code>,{" "}
          <code className="rounded bg-[var(--color-surface)] px-1">mes</code>,{" "}
          <code className="rounded bg-[var(--color-surface)] px-1">anio</code>.
        </p>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Subir nueva plantilla</h2>
        <form onSubmit={handleUpload} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej. Diploma TOGAF horizontal"
            className={inputCls}
          />
          <input
            ref={fileRef}
            type="file"
            required
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[var(--color-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Subiendo…" : "Subir"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tus plantillas</h2>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Cargando…</p>
        ) : templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            Aún no has subido plantillas de asistencia.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => {
              const isAcroform = !!t.has_acroform;
              const acroCount = Array.isArray(t.acroform_field_map)
                ? t.acroform_field_map.length
                : 0;
              const acroTotal = Array.isArray(t.acroform_fields)
                ? t.acroform_fields.length
                : 0;
              const fieldCount = Array.isArray(t.fields) ? t.fields.length : 0;
              const hasLogo = !!t.logo_position;
              return (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[var(--color-accent)]/15 p-2 text-[var(--color-accent)]">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {t.name}
                        {isAcroform && (
                          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            AcroForm
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {isAcroform
                          ? `${acroCount}/${acroTotal} campos asignados`
                          : fieldCount > 0
                            ? `${fieldCount} campos colocados`
                            : "Sin campos"}
                        {hasLogo ? " · logo definido" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/asistencia/plantillas/${t.id}/edit`}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)]"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deleting === t.id}
                      className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="Eliminar plantilla"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
