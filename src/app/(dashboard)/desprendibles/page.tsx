"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Upload, X, Send, Download } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { toast } from "react-hot-toast";
import { calculatePayment, formatCOP } from "@/lib/nomina/payment";

type TipoPersona = "trabajadores" | "instructores" | "proveedores";

type Persona = {
  id: number;
  nombre: string;
  email?: string;
  documento?: string;
  nit?: string;
  cargo?: string;
  salario?: number;
};

type Concepto = { concepto: string; valor: string };

const initialConcepto: Concepto = { concepto: "", valor: "" };

const ENDPOINTS: Record<TipoPersona, string> = {
  trabajadores: "/api/nomina/trabajadores",
  instructores: "/api/nomina/instructores",
  proveedores: "/api/nomina/proveedores",
};

export default function DesprendiblesPage() {
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>("trabajadores");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [devengados, setDevengados] = useState<Concepto[]>([{ ...initialConcepto }]);
  const [deducciones, setDeducciones] = useState<Concepto[]>([{ ...initialConcepto }]);
  const [dbDevengados, setDbDevengados] = useState<Concepto[]>([]);
  const [dbDeducciones, setDbDeducciones] = useState<Concepto[]>([]);
  const [anotaciones, setAnotaciones] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(ENDPOINTS[tipoPersona])
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPersonas(d))
      .catch(() => toast.error("No se pudieron cargar las personas"));
    setSelectedId("");
  }, [tipoPersona]);

  useEffect(() => {
    if (tipoPersona !== "trabajadores" || !selectedId) {
      setDbDevengados([]);
      setDbDeducciones([]);
      return;
    }
    Promise.all([
      fetch(`/api/nomina/devengados?trabajadorId=${selectedId}`).then((r) => r.json()),
      fetch(`/api/nomina/deducciones?trabajadorId=${selectedId}`).then((r) => r.json()),
    ])
      .then(([dev, ded]) => {
        setDbDevengados(
          (Array.isArray(dev) ? dev : []).map((d: { concepto: string; valor: number }) => ({
            concepto: d.concepto,
            valor: String(d.valor),
          })),
        );
        setDbDeducciones(
          (Array.isArray(ded) ? ded : []).map((d: { concepto: string; valor: number }) => ({
            concepto: d.concepto,
            valor: String(d.valor),
          })),
        );
      })
      .catch(() => {
        setDbDevengados([]);
        setDbDeducciones([]);
      });
  }, [tipoPersona, selectedId]);

  const persona = useMemo(
    () => personas.find((p) => String(p.id) === selectedId) ?? null,
    [personas, selectedId],
  );

  const valorAPagar = useMemo(
    () => calculatePayment(devengados, deducciones, dbDevengados, dbDeducciones),
    [devengados, deducciones, dbDevengados, dbDeducciones],
  );

  function buildPayload() {
    if (!persona) {
      toast.error("Selecciona una persona");
      return null;
    }
    if (!fechaInicio || !fechaFin) {
      toast.error("Selecciona fechas de inicio y fin");
      return null;
    }
    return {
      tipoPersona,
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        documento: persona.documento ?? persona.nit ?? "",
        cargo: persona.cargo ?? "",
        salario: persona.salario ?? 0,
        email: persona.email ?? "",
      },
      fechaInicio,
      fechaFin,
      devengados: devengados.filter((d) => d.concepto.trim()),
      deducciones: deducciones.filter((d) => d.concepto.trim()),
      dbDevengados,
      dbDeducciones,
    };
  }

  async function handleGenerate() {
    const payload = buildPayload();
    if (!payload) return;
    setBusy(true);
    const id = toast.loading("Generando desprendible…");
    try {
      const res = await fetch("/api/nomina/desprendible", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error al generar");

      const blob = base64ToBlob(j.pdfBase64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `desprendible_${payload.persona.nombre.replace(/\s+/g, "_")}_${j.comprobante}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Descargado", { id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmail() {
    const payload = buildPayload();
    if (!payload) return;
    if (!payload.persona.email) {
      toast.error("La persona no tiene email registrado");
      return;
    }
    setBusy(true);
    const id = toast.loading("Generando y enviando…");
    try {
      const genRes = await fetch("/api/nomina/desprendible", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const gen = await genRes.json();
      if (!genRes.ok) throw new Error(gen.error ?? "Error al generar PDF");

      let attachedFileBase64: string | null = null;
      if (archivo) attachedFileBase64 = await fileToBase64(archivo);

      const safeName = payload.persona.nombre.replace(/[^a-zA-Z0-9]+/g, "_");
      const sendRes = await fetch("/api/nomina/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: payload.persona.email,
          subject: `Desprendible - ${payload.persona.nombre} - ${payload.fechaFin}`,
          htmlContent: emailHtml({
            nombre: payload.persona.nombre,
            fechaInicio: payload.fechaInicio,
            fechaFin: payload.fechaFin,
            anotaciones,
          }),
          pdfBase64: gen.pdfBase64,
          historialId: gen.historialId,
          attachedFileBase64,
          filenamePdf: `desprendible_${safeName}_${gen.comprobante}.pdf`,
          filenameAttached: archivo
            ? `comprobante_${safeName}_${payload.fechaFin}.pdf`
            : undefined,
          nombrePersona: payload.persona.nombre,
        }),
      });
      const sj = await sendRes.json();
      if (!sendRes.ok) throw new Error(sj.error ?? "Error al enviar correo");

      toast.success("Enviado", { id });
      setFechaInicio("");
      setFechaFin("");
      setAnotaciones("");
      setArchivo(null);
      setSelectedId("");
      setDevengados([{ ...initialConcepto }]);
      setDeducciones([{ ...initialConcepto }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Generar desprendible</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Configura los datos del comprobante y genera o envía por correo.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo">
              <select
                value={tipoPersona}
                onChange={(e) => setTipoPersona(e.target.value as TipoPersona)}
                className={inputCls}
              >
                <option value="trabajadores">Empleados</option>
                <option value="instructores">Instructores</option>
                <option value="proveedores">Proveedores</option>
              </select>
            </Field>
            <Field label={tipoPersona === "proveedores" ? "Proveedor" : "Persona"}>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Seleccione…</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha inicio">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Fecha fin">
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {tipoPersona === "trabajadores" && (dbDevengados.length > 0 || dbDeducciones.length > 0) && (
            <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 md:grid-cols-2">
              <FixedList title="Devengados fijos" items={dbDevengados} />
              <FixedList title="Deducciones fijas" items={dbDeducciones} />
            </div>
          )}

          <ConceptoSection
            title="Devengados"
            color="emerald"
            items={devengados}
            setItems={setDevengados}
          />
          <ConceptoSection
            title="Deducciones"
            color="red"
            items={deducciones}
            setItems={setDeducciones}
          />

          <Field label="Anotaciones">
            <textarea
              value={anotaciones}
              onChange={(e) => setAnotaciones(e.target.value)}
              rows={3}
              placeholder="Notas opcionales que aparecerán en el correo"
              className={`${inputCls} min-h-[80px] resize-y`}
            />
          </Field>

          <FileInput file={archivo} onChange={setArchivo} />
        </section>

        <aside className="lg:sticky lg:top-6 self-start space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Resumen
          </h2>
          {persona ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{persona.nombre}</p>
              <p className="text-[var(--color-muted)]">
                {persona.documento ?? persona.nit ?? "—"}
              </p>
              {persona.email && <p className="text-xs text-[var(--color-muted)]">{persona.email}</p>}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Selecciona una persona.</p>
          )}

          <div className="rounded-xl bg-[var(--color-accent)]/15 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Valor a pagar</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-accent)]">
              {formatCOP(valorAPagar)}
            </p>
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> Generar PDF
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-surface-2)] disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Enviar por correo
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function FixedList({ title, items }: { title: string; items: Concepto[] }) {
  if (items.length === 0)
    return (
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {title}
        </h3>
        <p className="text-xs text-[var(--color-muted)]">Sin registros.</p>
      </div>
    );
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h3>
      <ul className="space-y-1 text-sm">
        {items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-3">
            <span className="truncate">{i.concepto}</span>
            <span className="font-medium">{formatCOP(i.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptoSection({
  title,
  color,
  items,
  setItems,
}: {
  title: string;
  color: "emerald" | "red";
  items: Concepto[];
  setItems: (next: Concepto[]) => void;
}) {
  const accent = color === "emerald" ? "text-emerald-400" : "text-red-400";
  const update = (idx: number, key: keyof Concepto, value: string) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${accent}`}>{title}</h3>
        <button
          type="button"
          onClick={() => setItems([...items, { ...initialConcepto }])}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs transition hover:bg-[var(--color-surface-2)]"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]"
          >
            <input
              value={it.concepto}
              onChange={(e) => update(idx, "concepto", e.target.value)}
              placeholder="Concepto"
              className={inputCls}
            />
            <NumericFormat
              value={it.valor}
              thousandSeparator="."
              decimalSeparator=","
              prefix="$"
              decimalScale={0}
              allowNegative={false}
              placeholder="$0"
              className={inputCls}
              onValueChange={(v) => update(idx, "valor", v.value)}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] px-3 transition hover:bg-[var(--color-surface-2)]"
              aria-label="Eliminar"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileInput({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Solo se permiten archivos PDF");
      e.target.value = "";
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("El archivo no debe superar 3 MB");
      e.target.value = "";
      return;
    }
    onChange(f);
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-[var(--color-muted)]">
        Adjunto opcional (PDF, máx 3MB)
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition hover:bg-[var(--color-surface-2)]"
        >
          <Upload className="h-4 w-4" /> Subir archivo
        </button>
        {file && (
          <>
            <span className="truncate text-sm text-[var(--color-muted)]">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-md p-1 text-red-400 hover:bg-red-950/40"
              aria-label="Quitar"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

function emailHtml(opts: {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  anotaciones: string;
}) {
  const { nombre, fechaInicio, fechaFin, anotaciones } = opts;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#222}
    .header{color:#2c3e50;font-size:18px}
    .detalles{margin:15px 0;padding:12px;background:#f8f9fa;border-radius:8px}
    ul{padding-left:20px}
  </style></head><body>
    <p class="header">Buen día ${nombre},</p>
    <p>Adjunto encontrará su desprendible de pago correspondiente al periodo:</p>
    <div class="detalles"><p><strong>Periodo:</strong> ${fechaInicio} – ${fechaFin}</p></div>
    <p><strong>Importante:</strong></p>
    <ul>
      <li>Conserve este documento para sus registros.</li>
      <li>Reporte inconsistencias a lideradmin@centicsas.com.co.</li>
      <li>Este es un correo automático y no recibe respuestas.</li>
    </ul>
    ${anotaciones ? `<h3>Anotaciones</h3><p>${escapeHtml(anotaciones)}</p>` : ""}
  </body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function base64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error("No se pudo leer archivo"));
    r.readAsDataURL(file);
  });
}
