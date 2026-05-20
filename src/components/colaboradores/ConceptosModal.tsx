"use client";
import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCOP } from "@/lib/nomina/payment";

type Concepto = { id: number; concepto: string; valor: number };

export default function ConceptosModal({
  open,
  onClose,
  trabajadorId,
  type,
}: {
  open: boolean;
  onClose: () => void;
  trabajadorId: number | null;
  type: "devengados" | "deducciones";
}) {
  const [items, setItems] = useState<Concepto[]>([]);
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !trabajadorId) return;
    fetch(`/api/nomina/${type}?trabajadorId=${trabajadorId}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setItems(data))
      .catch(() => toast.error("No se pudieron cargar"));
  }, [open, trabajadorId, type]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!trabajadorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/nomina/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trabajadorId, concepto, valor }),
      });
      if (!res.ok) {
        toast.error("No se pudo agregar");
        return;
      }
      const list = await fetch(`/api/nomina/${type}?trabajadorId=${trabajadorId}`).then((r) =>
        r.json(),
      );
      setItems(list);
      setConcepto("");
      setValor("");
      toast.success("Agregado");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/nomina/${type}/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((s) => s.filter((i) => i.id !== id));
    } else {
      toast.error("No se pudo eliminar");
    }
  }

  const title = type === "devengados" ? "Devengados fijos" : "Deducciones fijas";

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <p className="-mt-2 mb-4 text-xs text-[var(--color-muted)]">
        Estos valores se aplican automáticamente a los desprendibles del trabajador.
      </p>

      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
        <input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Concepto"
          required
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
        />
        <NumericFormat
          value={valor}
          thousandSeparator="."
          decimalSeparator=","
          prefix="$"
          decimalScale={0}
          allowNegative={false}
          placeholder="$0"
          required
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
          onValueChange={(v) => setValor(v.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          Agregar
        </button>
      </form>

      <ul className="mt-5 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Sin {type} configurados.
          </li>
        ) : (
          items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="truncate">{it.concepto}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatCOP(it.valor)}</span>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="rounded-md p-1 text-red-400 hover:bg-red-950/40"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}
