"use client";
import { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { toast } from "react-hot-toast";
import { FieldConfig } from "./types";

type Props = {
  fields: FieldConfig[];
  endpoint: string;
  itemId?: number | null;
  submitLabel: string;
  onSuccess: () => void;
  onClose: () => void;
  onDelete?: () => void;
};

export default function PersonaForm({
  fields,
  endpoint,
  itemId,
  submitLabel,
  onSuccess,
  onClose,
  onDelete,
}: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    fetch(`${endpoint}/${itemId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const f of fields) {
          const v = data?.[f.name];
          next[f.name] = v == null ? "" : String(v);
        }
        setFormData(next);
      })
      .catch(() => toast.error("No se pudieron cargar los datos"));
    return () => {
      cancelled = true;
    };
  }, [itemId, endpoint, fields]);

  const setValue = (name: string, value: string) =>
    setFormData((s) => ({ ...s, [name]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = itemId ? `${endpoint}/${itemId}` : endpoint;
      const method = itemId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo guardar");
        return;
      }
      toast.success(itemId ? "Actualizado" : "Creado");
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!itemId) return;
    if (!confirm("¿Eliminar este registro?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "No se pudo eliminar");
        return;
      }
      toast.success("Eliminado");
      onDelete?.();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            value={formData[f.name] ?? ""}
            onChange={(v) => setValue(f.name, v)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {itemId && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="mr-auto rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/40 disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm transition hover:bg-[var(--color-surface-2)]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {loading ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  const baseInput =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";
  const wrapperCls = field.colSpan === 2 ? "sm:col-span-2" : "";

  let control: React.ReactNode;
  if (field.type === "select") {
    control = (
      <select
        className={baseInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      >
        <option value="">Seleccione</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "currency") {
    control = (
      <NumericFormat
        value={value}
        thousandSeparator="."
        decimalSeparator=","
        prefix="$"
        decimalScale={0}
        allowNegative={false}
        className={baseInput}
        placeholder="$0"
        onValueChange={(values) => onChange(values.value)}
        required={field.required}
      />
    );
  } else {
    control = (
      <input
        className={baseInput}
        type={field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  return (
    <label className={`block ${wrapperCls}`}>
      <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
        {field.label}
      </span>
      {control}
    </label>
  );
}
