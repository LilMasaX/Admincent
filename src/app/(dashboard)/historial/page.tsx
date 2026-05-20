"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "react-hot-toast";

type HistorialItem = {
  id: number;
  persona_id: number;
  tipo_persona: "trabajadores" | "instructores" | "proveedores";
  nombre: string;
  fecha_generacion: string;
  fecha_envio: string | null;
  estado: string;
  eliminado: boolean;
  comprobante: number | null;
  has_payload: boolean;
};

const PAGE_SIZE = 12;

const tipoLabel: Record<HistorialItem["tipo_persona"], string> = {
  trabajadores: "Empleado",
  instructores: "Instructor",
  proveedores: "Proveedor",
};

const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

function base64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function HistorialPage() {
  const [data, setData] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/nomina/historial")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
        else setError(d?.error ?? "Respuesta inválida");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const visible = useMemo(
    () => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data, page],
  );

  async function handleRegenerar(item: HistorialItem) {
    setDownloading(item.id);
    const id = toast.loading("Regenerando desprendible…");
    try {
      const res = await fetch(`/api/nomina/regenerar?id=${item.id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Error al regenerar");
      const blob = base64ToBlob(j.pdfBase64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = item.nombre.replace(/\s+/g, "_");
      a.download = `desprendible_${safeName}_${j.comprobante}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Descargado", { id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error", { id });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Desprendibles generados y enviados. Descarga nuevamente sin regenerar datos desde cero.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-4 py-3 font-medium">Beneficiario</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Comprobante</th>
                <th className="px-4 py-3 font-medium">Generado</th>
                <th className="px-4 py-3 font-medium">Enviado</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    Cargando…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    Aún no se han generado desprendibles.
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)]/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      {r.nombre}
                      {r.eliminado && (
                        <span className="ml-2 rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs text-[var(--color-muted)]">
                          eliminado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {tipoLabel[r.tipo_persona]}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">
                      {r.comprobante ?? "—"}
                    </td>
                    <td className="px-4 py-3">{fmtDate(r.fecha_generacion)}</td>
                    <td className="px-4 py-3">{fmtDate(r.fecha_envio)}</td>
                    <td className="px-4 py-3">
                      <Badge estado={r.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!r.has_payload || downloading === r.id}
                        onClick={() => handleRegenerar(r)}
                        title={r.has_payload ? "Regenerar y descargar PDF" : "Sin datos para regenerar"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs transition hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {downloading === r.id ? "…" : "PDF"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3 text-sm">
            <span className="text-[var(--color-muted)]">
              Página {page} de {totalPages} · {data.length} registros
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`min-w-8 rounded-md px-2 py-1 text-xs transition ${
                    page === i + 1
                      ? "bg-[var(--color-accent)] text-white"
                      : "border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ estado }: { estado: string }) {
  const tone =
    estado === "Enviado"
      ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/40"
      : estado === "Fallido"
        ? "bg-red-900/40 text-red-300 border-red-700/40"
        : "bg-neutral-800 text-neutral-300 border-[var(--color-border)]";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tone}`}>{estado}</span>
  );
}
