"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Award, Download, Plus, Trash2, FileText, FileSignature } from "lucide-react";

type FieldDef = { key: string; page?: number; x: number; y: number; size?: number };

type Template = {
  id: string;
  name: string;
  kind: "pdf" | "docx";
  fields: FieldDef[];
  has_acroform: boolean;
  created_at: string;
};

type Certificate = {
  id: string;
  template_id: string;
  storage_path: string;
  values: Record<string, unknown>;
  created_at: string;
};

export default function CertificatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [dynPairs, setDynPairs] = useState<{ k: string; v: string }[]>([{ k: "", v: "" }]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const hasPlacedFields = (selected?.fields?.length ?? 0) > 0;

  useEffect(() => {
    fetch("/api/templates?tipo=certificado")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
    fetch("/api/certificates")
      .then((r) => r.json())
      .then((d) => setCertificates(d.certificates ?? []));
  }, []);

  useEffect(() => {
    setFieldValues({});
    setDynPairs([{ k: "", v: "" }]);
  }, [selectedId]);

  async function generate() {
    if (!selected) return;

    let values: Record<string, string> = {};
    if (hasPlacedFields) {
      values = { ...fieldValues };
    } else {
      for (const { k, v } of dynPairs) {
        if (k.trim()) values[k.trim()] = v;
      }
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, values }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error generando certificado");
        return;
      }
      toast.success("Certificado generado");
      setCertificates((prev) => [data.certificate, ...prev]);
    } finally {
      setGenerating(false);
    }
  }

  async function download(certId: string) {
    setDownloading(certId);
    try {
      // Endpoint regenerates the file on-demand and streams it with
      // Content-Disposition: attachment, so the browser downloads it.
      window.open(`/api/certificates/${certId}/url`, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  const needsDynPairs =
    selected && !hasPlacedFields && (selected.kind === "docx" || selected.has_acroform);

  const pdfNoFields =
    selected?.kind === "pdf" && !hasPlacedFields && !selected.has_acroform;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Certificados</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Genera certificados a partir de plantillas PDF o DOCX.{" "}
          <a href="/templates" className="text-[var(--color-accent)] hover:underline">
            Administrar plantillas →
          </a>
        </p>
      </header>

      {/* Generator */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
        <h2 className="text-lg font-semibold">Generar certificado</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Plantilla</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">Selecciona una plantilla...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.kind.toUpperCase()})
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              No tienes plantillas.{" "}
              <a href="/templates" className="text-[var(--color-accent)] hover:underline">
                Sube una aquí
              </a>
              .
            </p>
          )}
        </div>

        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              {selected.kind === "pdf" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <FileSignature className="h-4 w-4" />
              )}
              <span>
                {selected.kind === "pdf"
                  ? hasPlacedFields
                    ? `${selected.fields.length} campo${selected.fields.length !== 1 ? "s" : ""} configurado${selected.fields.length !== 1 ? "s" : ""}`
                    : selected.has_acroform
                    ? "AcroForm"
                    : "Sin campos"
                  : "Plantilla DOCX con marcadores"}
              </span>
            </div>

            {hasPlacedFields && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                      {f.key}
                    </label>
                    <input
                      value={fieldValues[f.key] ?? ""}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.key}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}

            {needsDynPairs && (
              <div className="space-y-2">
                <p className="text-xs text-[var(--color-muted)]">
                  {selected.kind === "docx"
                    ? "Ingresa los valores para los marcadores {{clave}} de tu plantilla."
                    : "Ingresa clave/valor según los campos AcroForm del PDF."}
                </p>
                {dynPairs.map((pair, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      placeholder="clave"
                      value={pair.k}
                      onChange={(e) =>
                        setDynPairs((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, k: e.target.value } : p)),
                        )
                      }
                      className="w-2/5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                    />
                    <input
                      placeholder="valor"
                      value={pair.v}
                      onChange={(e) =>
                        setDynPairs((prev) =>
                          prev.map((p, j) => (j === i ? { ...p, v: e.target.value } : p)),
                        )
                      }
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
                    />
                    <button
                      onClick={() => setDynPairs((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setDynPairs((prev) => [...prev, { k: "", v: "" }])}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar campo
                </button>
              </div>
            )}

            {pdfNoFields && (
              <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-xs text-[var(--color-muted)]">
                Este PDF no tiene campos configurados ni AcroForm.{" "}
                <a
                  href={`/templates/${selected.id}/edit`}
                  className="text-[var(--color-accent)] hover:underline"
                >
                  Configura campos en el editor →
                </a>
              </p>
            )}
          </div>
        )}

        <button
          onClick={generate}
          disabled={!selected || pdfNoFields || generating}
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? "Generando..." : "Generar certificado"}
        </button>
      </section>

      {/* Generated certificates */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Certificados generados</h2>
        {certificates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            No hay certificados generados aún.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {certificates.map((cert) => {
              const tpl = templates.find((t) => t.id === cert.template_id);
              return (
                <li
                  key={cert.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[var(--color-accent)]/15 p-2 text-[var(--color-accent)]">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{tpl?.name ?? "Plantilla eliminada"}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {new Date(cert.created_at).toLocaleDateString("es-CO", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => download(cert.id)}
                    disabled={downloading === cert.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading === cert.id ? "..." : "Descargar"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
