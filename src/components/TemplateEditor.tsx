"use client";

import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Trash2 } from "lucide-react";
import type { PdfFieldDefStored } from "@/lib/cert";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  templateId: string;
  pdfUrl: string;
  initialFields: PdfFieldDefStored[];
  pageSizes: Array<{ width: number; height: number }>;
};

const RENDER_WIDTH = 700;

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

export function TemplateEditor({ templateId, pdfUrl, initialFields, pageSizes }: Props) {
  const [pageIndex, setPageIndex] = useState(0);
  const [fields, setFields] = useState<PdfFieldDefStored[]>(initialFields);
  const [draftKey, setDraftKey] = useState("nombre");
  const [draftSize, setDraftSize] = useState(18);
  const [draftAlign, setDraftAlign] = useState<"left" | "center" | "right">("left");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const page = pageSizes[pageIndex];
  const scale = page ? RENDER_WIDTH / page.width : 1;
  const renderHeight = page ? page.height * scale : 0;

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!page || !draftKey.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const x = cssX / scale;
    const y = page.height - cssY / scale;
    setFields((prev) => [
      ...prev,
      { key: draftKey.trim(), page: pageIndex, x, y, size: draftSize, align: draftAlign },
    ]);
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/templates", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: templateId, fields }),
    });
    setSaving(false);
    if (res.ok) setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm">
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
        <div
          ref={containerRef}
          onClick={onClick}
          className="relative inline-block cursor-crosshair overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-xl"
          style={{ width: RENDER_WIDTH, height: renderHeight }}
        >
          <Document file={pdfUrl} loading={<p className="p-4 text-neutral-700">Cargando…</p>}>
            <Page
              pageNumber={pageIndex + 1}
              width={RENDER_WIDTH}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
          {fields
            .filter((f) => (f.page ?? 0) === pageIndex)
            .map((f, i) => {
              const cssX = f.x * scale;
              const cssY = renderHeight - f.y * scale;
              return (
                <div
                  key={i}
                  className="pointer-events-none absolute -translate-y-full rounded bg-[var(--color-accent)]/85 px-1.5 py-0.5 text-xs font-medium text-white shadow"
                  style={{ left: cssX, top: cssY }}
                >
                  {f.key}
                </div>
              );
            })}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-semibold">Nuevo campo</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--color-muted)]">Clave</span>
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--color-muted)]">Tamaño (pt)</span>
            <input
              type="number"
              value={draftSize}
              onChange={(e) => setDraftSize(Number(e.target.value))}
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
          <p className="text-xs text-[var(--color-muted)]">Haz clic sobre el PDF para colocar.</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-semibold">Campos ({fields.length})</h2>
          <ul className="max-h-72 space-y-1 overflow-auto text-sm">
            {fields.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-1 last:border-b-0"
              >
                <span className="truncate font-mono text-xs">
                  {f.key} · p{f.page ?? 0} · ({f.x.toFixed(0)}, {f.y.toFixed(0)})
                </span>
                <button
                  onClick={() => removeField(i)}
                  className="rounded-md p-1 text-red-400 hover:bg-red-950/40"
                  aria-label="Quitar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-[var(--color-accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar campos"}
        </button>
        {savedAt && <p className="text-xs text-emerald-400">Guardado a las {savedAt}</p>}
      </aside>
    </div>
  );
}
