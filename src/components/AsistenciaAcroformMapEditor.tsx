"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type FieldKey =
  | "nombre"
  | "cedula"
  | "curso"
  | "horas"
  | "instructor"
  | "dia"
  | "dia_inicio"
  | "dia_fin"
  | "mes"
  | "anio"
  | "dia_expedicion"
  | "mes_expedicion"
  | "anio_expedicion"
  | "adicional";

export type AcroformMapping = {
  pdfField: string;
  key: FieldKey;
  monthFormat?: "numeric" | "text";
};

export type LogoRect = {
  page?: number;
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

const KEYS: FieldKey[] = [
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
];

const KEY_LABEL: Record<FieldKey, string> = {
  nombre: "Nombre",
  cedula: "Cédula",
  curso: "Curso",
  horas: "Horas",
  instructor: "Instructor (firma)",
  dia: "Día",
  dia_inicio: "Día inicio",
  dia_fin: "Día fin",
  mes: "Mes",
  anio: "Año",
  dia_expedicion: "Día expedición",
  mes_expedicion: "Mes expedición",
  anio_expedicion: "Año expedición",
  adicional: "Adicional",
};

type Props = {
  templateId: string;
  pdfFieldNames: string[];
  initialMap: AcroformMapping[];
  pdfUrl: string;
  pageSizes: Array<{ width: number; height: number }>;
  initialLogo: LogoRect;
};

const RENDER_WIDTH = 800;

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

export function AsistenciaAcroformMapEditor({
  templateId,
  pdfFieldNames,
  initialMap,
  pdfUrl,
  pageSizes,
  initialLogo,
}: Props) {
  const [rows, setRows] = useState<Record<string, AcroformMapping | null>>(() => {
    const r: Record<string, AcroformMapping | null> = {};
    for (const name of pdfFieldNames) {
      const found = initialMap.find((m) => m.pdfField === name);
      r[name] = found ?? null;
    }
    return r;
  });
  const [logo, setLogo] = useState<LogoRect>(initialLogo);
  const [livePageSizes, setLivePageSizes] = useState<
    Record<number, { width: number; height: number }>
  >({});
  const [pageIndex, setPageIndex] = useState(0);
  const [drag, setDrag] = useState<null | { sx: number; sy: number; ex: number; ey: number }>(null);
  const [containerWidth, setContainerWidth] = useState(RENDER_WIDTH);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const page = livePageSizes[pageIndex] ?? pageSizes[pageIndex];
  const scale = page ? containerWidth / page.width : 1;
  const renderHeight = page ? page.height * scale : 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function setRowKey(pdfField: string, value: FieldKey | "") {
    setRows((prev) => {
      const next = { ...prev };
      if (value === "") next[pdfField] = null;
      else {
        const cur = next[pdfField];
        const isMonth = value === "mes" || value === "mes_expedicion";
        next[pdfField] = {
          pdfField,
          key: value,
          monthFormat: isMonth ? cur?.monthFormat ?? "numeric" : undefined,
        };
      }
      return next;
    });
  }

  function setRowMonth(pdfField: string, mf: "numeric" | "text") {
    setRows((prev) => {
      const cur = prev[pdfField];
      if (!cur || (cur.key !== "mes" && cur.key !== "mes_expedicion")) return prev;
      return { ...prev, [pdfField]: { ...cur, monthFormat: mf } };
    });
  }

  function canvasRect(e: React.MouseEvent<HTMLDivElement>) {
    const canvas = containerRef.current?.querySelector<HTMLCanvasElement>("canvas");
    return (canvas ?? e.currentTarget).getBoundingClientRect();
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const rect = canvasRect(e);
    setDrag({
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
      ex: e.clientX - rect.left,
      ey: e.clientY - rect.top,
    });
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!drag) return;
    const rect = canvasRect(e);
    setDrag({ ...drag, ex: e.clientX - rect.left, ey: e.clientY - rect.top });
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!drag || !page) return;
    const rect = canvasRect(e);
    const liveScale = rect.width / page.width;
    const x1 = Math.min(drag.sx, drag.ex);
    const y1 = Math.min(drag.sy, drag.ey);
    const x2 = Math.max(drag.sx, drag.ex);
    const y2 = Math.max(drag.sy, drag.ey);
    setDrag(null);
    if (x2 - x1 < 8 || y2 - y1 < 8) return;
    setLogo({
      page: pageIndex,
      x: x1 / liveScale,
      y: page.height - y2 / liveScale,
      width: (x2 - x1) / liveScale,
      height: (y2 - y1) / liveScale,
    });
  }

  async function save() {
    const map = Object.values(rows).filter((m): m is AcroformMapping => m !== null);

    const seen = new Set<FieldKey>();
    for (const m of map) {
      if (seen.has(m.key)) {
        toast.error(`El campo "${KEY_LABEL[m.key]}" está asignado más de una vez`);
        return;
      }
      seen.add(m.key);
    }

    setSaving(true);
    const id = toast.loading("Guardando…");
    try {
      const res = await fetch("/api/asistencia/templates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: templateId,
          acroform_field_map: map,
          logo_position: logo,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Error al guardar");
      }
      toast.success("Guardado", { id });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id });
    } finally {
      setSaving(false);
    }
  }

  const usedKeys = new Set(
    Object.values(rows)
      .filter((m): m is AcroformMapping => m !== null)
      .map((m) => m.key),
  );

  const dragRect =
    drag
      ? {
          left: Math.min(drag.sx, drag.ex),
          top: Math.min(drag.sy, drag.ey),
          width: Math.abs(drag.ex - drag.sx),
          height: Math.abs(drag.ey - drag.sy),
        }
      : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-semibold">Detectado: PDF con campos de formulario</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Asigna a cada campo del PDF qué dato de la nómina debe rellenar. Los campos
          sin asignación quedan vacíos. Para el mes elige número (04) o texto (abril).
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Campo en el PDF</th>
              <th className="px-4 py-3 text-left">Asignar a</th>
              <th className="px-4 py-3 text-left">Opciones</th>
            </tr>
          </thead>
          <tbody>
            {pdfFieldNames.map((name) => {
              const row = rows[name];
              const currentKey = row?.key ?? "";
              return (
                <tr key={name} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-mono text-xs">{name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={currentKey}
                      onChange={(e) => setRowKey(name, e.target.value as FieldKey | "")}
                      className={inputCls}
                    >
                      <option value="">— No usar —</option>
                      {KEYS.map((k) => {
                        const taken = usedKeys.has(k) && k !== currentKey;
                        return (
                          <option key={k} value={k} disabled={taken}>
                            {KEY_LABEL[k]}
                            {taken ? " (en uso)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {row?.key === "mes" || row?.key === "mes_expedicion" ? (
                      <select
                        value={row.monthFormat ?? "numeric"}
                        onChange={(e) =>
                          setRowMonth(name, e.target.value as "numeric" | "text")
                        }
                        className={inputCls}
                      >
                        <option value="numeric">Número (04)</option>
                        <option value="text">Texto (abril)</option>
                      </select>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Logo extra (opcional)</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Arrastra un rectángulo sobre el PDF para definir dónde irá un logo extra
              al generar. Se incrustará proporcionalmente dentro del área.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
            >
              ←
            </button>
            <span className="text-[var(--color-muted)]">
              Página {pageIndex + 1} / {pageSizes.length}
            </span>
            <button
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 disabled:opacity-50"
              onClick={() => setPageIndex((i) => Math.min(pageSizes.length - 1, i + 1))}
              disabled={pageIndex >= pageSizes.length - 1}
            >
              →
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div
            ref={containerRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={(e) => drag && onMouseUp(e)}
            className="relative block w-full cursor-cell overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-xl"
            style={{
              maxWidth: RENDER_WIDTH,
              aspectRatio: page ? `${page.width} / ${page.height}` : undefined,
            }}
          >
            <Document file={pdfUrl} loading={<p className="p-4 text-neutral-700">Cargando…</p>}>
              <Page
                pageNumber={pageIndex + 1}
                width={containerWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={(pageProxy) => {
                  const vp = pageProxy.getViewport({ scale: 1 });
                  setLivePageSizes((prev) => {
                    const cur = prev[pageIndex];
                    if (cur && cur.width === vp.width && cur.height === vp.height) return prev;
                    return { ...prev, [pageIndex]: { width: vp.width, height: vp.height } };
                  });
                }}
              />
            </Document>

            {logo && (logo.page ?? 0) === pageIndex && page && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-emerald-400 bg-emerald-400/10"
                style={{
                  left: logo.x * scale,
                  top: renderHeight - (logo.y + logo.height) * scale,
                  width: logo.width * scale,
                  height: logo.height * scale,
                }}
              >
                <span className="absolute -top-5 left-0 rounded bg-emerald-500 px-1.5 py-0.5 text-xs font-medium text-white shadow">
                  Logo
                </span>
              </div>
            )}

            {dragRect && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-emerald-300 bg-emerald-300/20"
                style={dragRect}
              />
            )}
          </div>

          <aside className="space-y-3">
            {logo ? (
              <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs">
                <p className="font-mono">
                  pág {(logo.page ?? 0) + 1} · ({logo.x.toFixed(0)}, {logo.y.toFixed(0)}) ·{" "}
                  {logo.width.toFixed(0)}×{logo.height.toFixed(0)} pt
                </p>
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-red-400 hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
                Sin posición definida. Arrastra sobre el PDF para definirla.
              </p>
            )}
          </aside>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar mapeo"}
        </button>
        {savedAt && <p className="text-xs text-emerald-400">Guardado a las {savedAt}</p>}
      </div>
    </div>
  );
}
