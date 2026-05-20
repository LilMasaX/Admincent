"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { parseParticipantesCsv, type Participante } from "@/lib/asistencia/csv";

type Template = {
  id: string;
  name: string;
  fields: { key: string; monthFormat?: "numeric" | "text" }[];
  logo_position: { width: number; height: number } | null;
};

type Mode = "individual" | "lote";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

export default function AsistenciaGeneratorPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [curso, setCurso] = useState("");
  const [instructor, setInstructor] = useState("");
  const [horas, setHoras] = useState("");
  const [fecha, setFecha] = useState("");
  const [mode, setMode] = useState<Mode>("individual");
  const [single, setSingle] = useState<Participante>({ nombre: "" });
  const [bulk, setBulk] = useState<Participante[]>([]);
  const [csvText, setCsvText] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/asistencia/templates")
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.templates) && setTemplates(d.templates))
      .catch(() => toast.error("No se pudieron cargar plantillas"));
  }, []);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const templateKeys = useMemo(
    () => new Set(template?.fields.map((f) => f.key) ?? []),
    [template],
  );
  const templateReady = useMemo(
    () => templateKeys.has("nombre") && templateKeys.has("curso"),
    [templateKeys],
  );
  const usesInstructor = templateKeys.has("instructor");
  const usesHoras = templateKeys.has("horas");
  const usesFecha =
    templateKeys.has("dia") || templateKeys.has("mes") || templateKeys.has("anio");

  function handleCsvText(t: string) {
    setCsvText(t);
    try {
      const parsed = parseParticipantesCsv(t);
      setBulk(parsed);
    } catch (e) {
      setBulk([]);
      if (t.trim()) toast.error(e instanceof Error ? e.message : "CSV inválido");
    }
  }

  async function handleCsvFile(f: File | null) {
    if (!f) return;
    const text = await f.text();
    handleCsvText(text);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        const i = s.indexOf(",");
        res(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => rej(new Error("No se pudo leer logo"));
      r.readAsDataURL(file);
    });
  }

  function downloadBase64(base64: string, mime: string, filename: string) {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleGenerate() {
    if (!template) {
      toast.error("Selecciona una plantilla");
      return;
    }
    if (!templateReady) {
      toast.error("La plantilla no tiene los 3 campos colocados");
      return;
    }
    if (!curso.trim()) {
      toast.error("Ingresa el nombre del curso");
      return;
    }
    const participantes =
      mode === "individual"
        ? single.nombre.trim()
          ? [{ nombre: single.nombre.trim(), cedula: single.cedula?.trim() || undefined }]
          : []
        : bulk;
    if (participantes.length === 0) {
      toast.error(mode === "individual" ? "Completa nombre y cédula" : "Lista vacía");
      return;
    }

    let logoBase64: string | null = null;
    let logoMime: "image/png" | "image/jpeg" | null = null;
    if (logoFile && template.logo_position) {
      logoBase64 = await fileToBase64(logoFile);
      logoMime = logoFile.type === "image/png" ? "image/png" : "image/jpeg";
    }

    let dia: number | undefined;
    let mes: number | undefined;
    let anio: number | undefined;
    if (usesFecha && fecha) {
      const [y, m, d] = fecha.split("-").map(Number);
      if (y && m && d) {
        anio = y;
        mes = m;
        dia = d;
      }
    }
    if (usesFecha && (!dia || !mes || !anio)) {
      toast.error("Selecciona la fecha del curso");
      return;
    }

    setBusy(true);
    const id = toast.loading(`Generando ${participantes.length} certificado(s)…`);
    try {
      const res = await fetch("/api/asistencia/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          curso: curso.trim(),
          instructor: usesInstructor && instructor.trim() ? instructor.trim() : undefined,
          horas: usesHoras && horas.trim() ? horas.trim() : undefined,
          dia,
          mes,
          anio,
          participantes,
          logoBase64,
          logoMime,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error al generar");
      const mime = j.kind === "zip" ? "application/zip" : "application/pdf";
      downloadBase64(j.base64, mime, j.filename);
      toast.success("Descargado", { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error", { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Certificados de asistencia</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Genera certificados tipo diploma para uno o muchos participantes.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <Field label="Plantilla">
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccione…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {template && !templateReady && (
              <p className="mt-1 text-xs text-amber-400">
                Esta plantilla aún no tiene los 3 campos requeridos. Edítala primero.
              </p>
            )}
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Curso">
              <input
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                placeholder="Ej. TOGAF Foundation"
                className={inputCls}
              />
            </Field>
            {usesInstructor && (
              <Field label="Instructor (firma)">
                <input
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className={inputCls}
                />
              </Field>
            )}
            {usesHoras && (
              <Field label="Horas del curso">
                <input
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="Ej. 40"
                  className={inputCls}
                />
              </Field>
            )}
            {usesFecha && (
              <Field label="Fecha del curso">
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("individual")}
              className={`flex-1 rounded-md px-3 py-1.5 ${mode === "individual" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setMode("lote")}
              className={`flex-1 rounded-md px-3 py-1.5 ${mode === "lote" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
            >
              Lote
            </button>
          </div>

          {mode === "individual" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre">
                <input
                  value={single.nombre}
                  onChange={(e) => setSingle({ ...single, nombre: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Cédula (opcional)">
                <input
                  value={single.cedula ?? ""}
                  onChange={(e) => setSingle({ ...single, cedula: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          ) : (
            <BulkSection
              csvText={csvText}
              onCsvText={handleCsvText}
              onFile={handleCsvFile}
              participantes={bulk}
              onClear={() => {
                setCsvText("");
                setBulk([]);
              }}
              onRemove={(i) => setBulk(bulk.filter((_, idx) => idx !== i))}
              onAdd={() => setBulk([...bulk, { nombre: "" }])}
              onEdit={(i, p) => setBulk(bulk.map((b, idx) => (idx === i ? p : b)))}
            />
          )}

          {template?.logo_position && (
            <Field label="Logo extra (opcional)">
              <LogoInput file={logoFile} onChange={setLogoFile} />
            </Field>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 self-start space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Resumen
          </h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-[var(--color-muted)]">Plantilla:</span>{" "}
              {template?.name ?? "—"}
            </p>
            <p>
              <span className="text-[var(--color-muted)]">Curso:</span> {curso || "—"}
            </p>
            <p>
              <span className="text-[var(--color-muted)]">Participantes:</span>{" "}
              {mode === "individual"
                ? single.nombre
                  ? 1
                  : 0
                : bulk.length}
            </p>
            {logoFile && (
              <p className="text-xs text-emerald-400">Logo extra: {logoFile.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || !templateReady}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Generar y descargar
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Si son varios, recibirás un ZIP con un PDF por participante.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function BulkSection(props: {
  csvText: string;
  onCsvText: (t: string) => void;
  onFile: (f: File | null) => void;
  participantes: Participante[];
  onClear: () => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
  onEdit: (i: number, p: Participante) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-muted)]">
          Pega lista de nombres o CSV con encabezado <code>nombre</code> (cédula opcional){" "}
          <code>.csv</code>.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)]">
          <Upload className="h-3.5 w-3.5" />
          Subir CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => props.onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <textarea
        value={props.csvText}
        onChange={(e) => props.onCsvText(e.target.value)}
        rows={4}
        placeholder={"nombre\nMaría Pérez\nJuan López"}
        className={`${inputCls} font-mono text-xs`}
      />
      {props.participantes.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {props.participantes.length} participantes
            </h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={props.onAdd}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-surface)]"
              >
                <Plus className="h-3 w-3" /> Añadir
              </button>
              <button
                type="button"
                onClick={props.onClear}
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
              >
                Vaciar
              </button>
            </div>
          </div>
          <ul className="max-h-64 space-y-1 overflow-auto">
            {props.participantes.map((p, i) => (
              <li key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <input
                  value={p.nombre}
                  onChange={(e) => props.onEdit(i, { ...p, nombre: e.target.value })}
                  placeholder="Nombre"
                  className={inputCls}
                />
                <input
                  value={p.cedula ?? ""}
                  onChange={(e) => props.onEdit(i, { ...p, cedula: e.target.value || undefined })}
                  placeholder="Cédula (opcional)"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => props.onRemove(i)}
                  className="rounded-md border border-[var(--color-border)] px-2 hover:bg-red-950/30"
                  aria-label="Quitar"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LogoInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-surface-2)]">
        <Upload className="h-4 w-4" /> {file ? "Cambiar" : "Subir logo"}
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <>
          <span className="truncate text-xs text-[var(--color-muted)]">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md p-1 text-red-400 hover:bg-red-950/40"
            aria-label="Quitar logo"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
