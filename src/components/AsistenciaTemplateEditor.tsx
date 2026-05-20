"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Trash2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type FieldKey =
  | "nombre"
  | "cedula"
  | "curso"
  | "horas"
  | "instructor"
  | "dia"
  | "mes"
  | "anio";

export type AsistenciaField = {
  key: FieldKey;
  page?: number;
  x: number;
  y: number;
  size?: number;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  autoShrink?: boolean;
  monthFormat?: "numeric" | "text";
};

export type LogoRect = {
  page?: number;
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

type Props = {
  templateId: string;
  pdfUrl: string;
  initialFields: AsistenciaField[];
  initialLogo: LogoRect;
  pageSizes: Array<{ width: number; height: number }>;
};

const RENDER_WIDTH = 800; // max render width; actual is capped by container

const KEYS: FieldKey[] = [
  "nombre",
  "cedula",
  "curso",
  "horas",
  "instructor",
  "dia",
  "mes",
  "anio",
];

const KEY_LABEL: Record<FieldKey, string> = {
  nombre: "Nombre",
  cedula: "Cédula",
  curso: "Curso",
  horas: "Horas",
  instructor: "Instructor (firma)",
  dia: "Día",
  mes: "Mes",
  anio: "Año",
};

const KEY_PREVIEW: Record<FieldKey, string> = {
  nombre: "María García",
  cedula: "1023456789",
  curso: "TOGAF Foundation",
  horas: "40",
  instructor: "Juan Pérez",
  dia: "15",
  mes: "abril",
  anio: "2026",
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

export function AsistenciaTemplateEditor({
  templateId,
  pdfUrl,
  initialFields,
  initialLogo,
  pageSizes,
}: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [fields, setFields] = useState<AsistenciaField[]>(initialFields);
  const [logo, setLogo] = useState<LogoRect>(initialLogo);
  const [mode, setMode] = useState<"text" | "logo">("text");
  const [draftKey, setDraftKey] = useState<FieldKey>("nombre");
  const [draftSize, setDraftSize] = useState("24");
  const [draftAlign, setDraftAlign] = useState<"left" | "center" | "right">("center");
  const [draftAutoShrink, setDraftAutoShrink] = useState(true);
  const [draftMaxWidth, setDraftMaxWidth] = useState("400");
  const [draftMonthFormat, setDraftMonthFormat] = useState<"numeric" | "text">("numeric");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [drag, setDrag] = useState<null | { sx: number; sy: number; ex: number; ey: number }>(null);
  const [containerWidth, setContainerWidth] = useState(RENDER_WIDTH);
  const containerRef = useRef<HTMLDivElement>(null);

  const page = pageSizes[pageIndex];
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

  const parsedSize = Math.max(1, parseInt(draftSize) || 24);
  const parsedMaxWidth = Math.max(10, parseInt(draftMaxWidth) || 400);

  function pdfCoords(e: React.MouseEvent<HTMLDivElement>) {
    if (!page) return null;
    // Use the canvas element directly — it's the exact render surface, no container offsets
    const canvas = containerRef.current?.querySelector<HTMLCanvasElement>("canvas");
    const rect = (canvas ?? e.currentTarget).getBoundingClientRect();
    const liveScale = rect.width / page.width;
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    if (cssX < 0 || cssX > rect.width || cssY < 0 || cssY > rect.height) return null;
    return { x: cssX / liveScale, y: page.height - cssY / liveScale };
  }

  function onClickPdf(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "text") return;
    const c = pdfCoords(e);
    if (!c) return;
    const newField: AsistenciaField = {
      key: draftKey,
      page: pageIndex,
      x: c.x,
      y: c.y,
      size: parsedSize,
      align: draftAlign,
      autoShrink: draftAutoShrink,
      maxWidth: draftAutoShrink ? parsedMaxWidth : undefined,
      monthFormat: draftKey === "mes" ? draftMonthFormat : undefined,
    };
    setFields((prev) => [
      ...prev.filter((f) => !(f.key === draftKey && (f.page ?? 0) === pageIndex)),
      newField,
    ]);
  }

  function canvasRect(e: React.MouseEvent<HTMLDivElement>) {
    const canvas = containerRef.current?.querySelector<HTMLCanvasElement>("canvas");
    return (canvas ?? e.currentTarget).getBoundingClientRect();
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "logo") return;
    const rect = canvasRect(e);
    setDrag({
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
      ex: e.clientX - rect.left,
      ey: e.clientY - rect.top,
    });
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "logo" || !drag) return;
    const rect = canvasRect(e);
    setDrag({ ...drag, ex: e.clientX - rect.left, ey: e.clientY - rect.top });
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "logo" || !drag || !page) return;
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

  function removeField(key: FieldKey, pg: number) {
    setFields((prev) => prev.filter((f) => !(f.key === key && (f.page ?? 0) === pg)));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/asistencia/templates", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: templateId, fields, logo_position: logo }),
    });
    setSaving(false);
    if (res.ok) setSavedAt(new Date().toLocaleTimeString());
  }

  const dragRect =
    drag && mode === "logo"
      ? {
          left: Math.min(drag.sx, drag.ex),
          top: Math.min(drag.sy, drag.ey),
          width: Math.abs(drag.ex - drag.sx),
          height: Math.abs(drag.ey - drag.sy),
        }
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
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
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded-md px-3 py-1.5 ${mode === "text" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
            >
              Texto
            </button>
            <button
              type="button"
              onClick={() => setMode("logo")}
              className={`rounded-md px-3 py-1.5 ${mode === "logo" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-muted)]"}`}
            >
              Logo
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          onClick={onClickPdf}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={(e) => drag && onMouseUp(e)}
          className={`relative block w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-xl ${
            mode === "text" ? "cursor-crosshair" : "cursor-cell"
          }`}
          style={{ maxWidth: RENDER_WIDTH, aspectRatio: page ? `${page.width} / ${page.height}` : undefined }}
        >
          <Document file={pdfUrl} loading={<p className="p-4 text-neutral-700">Cargando…</p>}>
            <Page
              pageNumber={pageIndex + 1}
              width={containerWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          {fields
            .filter((f) => (f.page ?? 0) === pageIndex)
            .map((f) => {
              const fSize = f.size ?? 18;
              const fontPx = fSize * scale;
              const anchorX = f.x * scale;
              const anchorY = renderHeight - f.y * scale;
              const isInstructor = f.key === "instructor";

              const widthPx = f.maxWidth
                ? f.maxWidth * scale
                : Math.max(fontPx * 2, KEY_PREVIEW[f.key].length * fontPx * 0.58);

              let boxLeft = anchorX;
              if (f.align === "center") boxLeft = anchorX - widthPx / 2;
              else if (f.align === "right") boxLeft = anchorX - widthPx;

              const capH = fontPx * 0.72;
              const descentH = fontPx * 0.22;

              return (
                <div key={f.key} className="pointer-events-none">
                  {/* Baseline dot */}
                  <div
                    className="absolute z-30 h-2 w-2 -translate-x-1 -translate-y-1 rounded-full bg-[var(--color-accent)] ring-2 ring-white"
                    style={{ left: anchorX, top: anchorY }}
                  />
                  {/* Text preview box — baseline at anchorY */}
                  <div
                    className="absolute z-10 border border-dashed border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5"
                    style={{
                      left: boxLeft,
                      top: anchorY - capH,
                      width: widthPx,
                      height: capH + descentH,
                      overflow: "visible",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        fontSize: fontPx,
                        lineHeight: 1,
                        fontWeight: isInstructor ? 400 : 700,
                        fontStyle: isInstructor ? "italic" : "normal",
                        fontFamily: isInstructor
                          ? "Georgia, 'Times New Roman', serif"
                          : "Arial, Helvetica, sans-serif",
                        color: "rgba(244, 67, 54, 0.6)",
                        whiteSpace: "nowrap",
                        overflow: "visible",
                        textAlign: f.align ?? "left",
                      }}
                    >
                      {KEY_PREVIEW[f.key]}
                    </span>
                  </div>
                  {/* Chip above box */}
                  <div
                    className="absolute z-30 -translate-y-full whitespace-nowrap rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow"
                    style={{ left: boxLeft, top: anchorY - capH }}
                  >
                    {KEY_LABEL[f.key]} · {fSize}pt
                  </div>
                </div>
              );
            })}

          {logo && (logo.page ?? 0) === pageIndex && (
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
      </div>

      <aside className="space-y-4">
        {mode === "text" ? (
          <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="font-semibold">Colocar texto</h2>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">Campo</span>
              <select
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value as FieldKey)}
                className={inputCls}
              >
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KEY_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">Tamaño (pt)</span>
              <input
                type="number"
                min={1}
                max={300}
                value={draftSize}
                onChange={(e) => setDraftSize(e.target.value)}
                onBlur={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 24);
                  setDraftSize(String(v));
                }}
                className={inputCls}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">Alineación</span>
              <select
                value={draftAlign}
                onChange={(e) => setDraftAlign(e.target.value as typeof draftAlign)}
                className={inputCls}
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draftAutoShrink}
                onChange={(e) => setDraftAutoShrink(e.target.checked)}
              />
              <span>Auto-ajustar si excede ancho</span>
            </label>

            {draftAutoShrink && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-[var(--color-muted)]">Ancho máximo (pt)</span>
                <input
                  type="number"
                  min={10}
                  value={draftMaxWidth}
                  onChange={(e) => setDraftMaxWidth(e.target.value)}
                  onBlur={(e) => {
                    const v = Math.max(10, parseInt(e.target.value) || 400);
                    setDraftMaxWidth(String(v));
                  }}
                  className={inputCls}
                />
              </label>
            )}

            {draftKey === "mes" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-[var(--color-muted)]">Formato del mes</span>
                <select
                  value={draftMonthFormat}
                  onChange={(e) => setDraftMonthFormat(e.target.value as "numeric" | "text")}
                  className={inputCls}
                >
                  <option value="numeric">Número (04)</option>
                  <option value="text">Texto (abril)</option>
                </select>
              </label>
            )}

            {/* Live preview of current size */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-center">
              <span
                style={{
                  fontSize: Math.min(parsedSize * scale * 0.4, 48),
                  fontWeight: draftKey === "instructor" ? 400 : 700,
                  fontStyle: draftKey === "instructor" ? "italic" : "normal",
                  fontFamily:
                    draftKey === "instructor"
                      ? "Georgia, serif"
                      : "Arial, sans-serif",
                  color: "rgba(244,67,54,0.8)",
                  lineHeight: 1.2,
                }}
              >
                {KEY_PREVIEW[draftKey]}
              </span>
              <p className="mt-1 text-[10px] text-[var(--color-muted)]">{parsedSize}pt · {draftAlign}</p>
            </div>

            <p className="text-xs text-[var(--color-muted)]">Haz clic en el PDF para colocar.</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="font-semibold">Logo opcional</h2>
            <p className="text-xs text-[var(--color-muted)]">
              Arrastra un rectángulo en la página para definir la posición del logo extra.
              Se incrustará proporcionalmente dentro del área.
            </p>
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
                Sin posición definida.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-semibold">Campos colocados</h2>
          {fields.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">Aún ninguno.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {fields.map((f) => (
                <li
                  key={`${f.key}-${f.page ?? 0}`}
                  className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-1 last:border-b-0"
                >
                  <span className="font-mono text-xs">
                    {KEY_LABEL[f.key]} · p{(f.page ?? 0) + 1} · {f.size}pt · {f.align}
                    {f.autoShrink ? ` · ≤${f.maxWidth}pt` : ""}
                    {f.key === "mes" ? ` · ${f.monthFormat === "text" ? "texto" : "núm"}` : ""}
                  </span>
                  <button
                    onClick={() => removeField(f.key, f.page ?? 0)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-950/40"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-[var(--color-accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar plantilla"}
        </button>
        {savedAt && <p className="text-xs text-emerald-400">Guardado a las {savedAt}</p>}
      </aside>
    </div>
  );
}
