"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Upload } from "lucide-react";
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

  const inputCls =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plantillas de asistencia</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Sube un PDF tipo diploma horizontal. Coloca los campos{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">nombre</code>,{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">cedula</code>,{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">curso</code> y opcionales{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">instructor</code>,{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">dia</code>{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">mes</code>{" "}
            <code className="rounded bg-[var(--color-surface-2)] px-1">año</code>.
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
                  <Link
                    href={`/asistencia/plantillas/${t.id}/edit`}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)]"
                  >
                    Editar
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
