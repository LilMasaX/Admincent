"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PdfFieldDefStored } from "@/lib/cert";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

type Props = {
  templateId: string;
  pdfUrl: string;
  initialFields: PdfFieldDefStored[];
  pageSizes: Array<{ width: number; height: number }>;
};

const RENDER_WIDTH = 700;

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
        <div className="mb-2 flex items-center gap-2 text-sm">
          <button
            className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
          >
            ←
          </button>
          <span>
            Page {pageIndex + 1} / {pageSizes.length}
          </span>
          <button
            className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => setPageIndex((i) => Math.min(pageSizes.length - 1, i + 1))}
            disabled={pageIndex >= pageSizes.length - 1}
          >
            →
          </button>
        </div>
        <div
          ref={containerRef}
          onClick={onClick}
          className="relative inline-block cursor-crosshair border bg-white shadow"
          style={{ width: RENDER_WIDTH, height: renderHeight }}
        >
          <Document file={pdfUrl} loading={<p className="p-4">Loading PDF…</p>}>
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
                  className="pointer-events-none absolute -translate-y-full rounded bg-blue-500/80 px-1 text-xs text-white"
                  style={{ left: cssX, top: cssY }}
                >
                  {f.key}
                </div>
              );
            })}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border p-4 space-y-3">
          <h2 className="font-semibold">New field on click</h2>
          <label className="block text-sm">
            Key
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            Size (pt)
            <input
              type="number"
              value={draftSize}
              onChange={(e) => setDraftSize(Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
          <label className="block text-sm">
            Align
            <select
              value={draftAlign}
              onChange={(e) => setDraftAlign(e.target.value as typeof draftAlign)}
              className="mt-1 w-full rounded border px-2 py-1"
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
          <p className="text-xs text-neutral-500">Click on the PDF to drop a placement.</p>
        </div>

        <div className="rounded-2xl border p-4 space-y-2">
          <h2 className="font-semibold">Fields ({fields.length})</h2>
          <ul className="space-y-1 text-sm max-h-72 overflow-auto">
            {fields.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 border-b pb-1">
                <span className="font-mono">
                  {f.key} · p{f.page ?? 0} · ({f.x.toFixed(0)}, {f.y.toFixed(0)})
                </span>
                <button onClick={() => removeField(i)} className="text-red-600 text-xs">
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save fields"}
        </button>
        {savedAt && <p className="text-xs text-green-700">Saved {savedAt}</p>}
      </aside>
    </div>
  );
}
