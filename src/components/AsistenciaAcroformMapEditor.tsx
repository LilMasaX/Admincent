"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

type FieldKey =
  | "nombre"
  | "cedula"
  | "curso"
  | "horas"
  | "instructor"
  | "dia"
  | "mes"
  | "anio";

export type AcroformMapping = {
  pdfField: string;
  key: FieldKey;
  monthFormat?: "numeric" | "text";
};

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

type Props = {
  templateId: string;
  pdfFieldNames: string[];
  initialMap: AcroformMapping[];
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none";

export function AsistenciaAcroformMapEditor({
  templateId,
  pdfFieldNames,
  initialMap,
}: Props) {
  const [rows, setRows] = useState<Record<string, AcroformMapping | null>>(() => {
    const r: Record<string, AcroformMapping | null> = {};
    for (const name of pdfFieldNames) {
      const found = initialMap.find((m) => m.pdfField === name);
      r[name] = found ?? null;
    }
    return r;
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function setRowKey(pdfField: string, value: FieldKey | "") {
    setRows((prev) => {
      const next = { ...prev };
      if (value === "") next[pdfField] = null;
      else {
        const cur = next[pdfField];
        next[pdfField] = {
          pdfField,
          key: value,
          monthFormat: value === "mes" ? cur?.monthFormat ?? "numeric" : undefined,
        };
      }
      return next;
    });
  }

  function setRowMonth(pdfField: string, mf: "numeric" | "text") {
    setRows((prev) => {
      const cur = prev[pdfField];
      if (!cur || cur.key !== "mes") return prev;
      return { ...prev, [pdfField]: { ...cur, monthFormat: mf } };
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
        body: JSON.stringify({ id: templateId, acroform_field_map: map }),
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

  return (
    <div className="space-y-4">
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
                    {row?.key === "mes" ? (
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
