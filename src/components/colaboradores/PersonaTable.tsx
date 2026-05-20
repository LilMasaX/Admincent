"use client";
import { useState } from "react";
import { Pencil, CircleMinus, CirclePlus } from "lucide-react";
import { formatCOP } from "@/lib/nomina/payment";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export default function PersonaTable<T extends { id: number }>({
  rows,
  columns,
  onEdit,
  onAddDevengado,
  onAddDeduccion,
  pageSize = 10,
  emptyText = "No hay registros.",
}: {
  rows: T[];
  columns: Column<T>[];
  onEdit: (id: number) => void;
  onAddDevengado?: (id: number) => void;
  onAddDeduccion?: (id: number) => void;
  pageSize?: number;
  emptyText?: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              {columns.map((c) => (
                <th key={String(c.key)} className={`px-4 py-3 font-medium ${c.className ?? ""}`}>
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-[var(--color-muted)]"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-border)] last:border-b-0 transition hover:bg-[var(--color-surface-2)]/40"
                >
                  {columns.map((c) => {
                    const raw = c.render
                      ? c.render(row)
                      : (row as Record<string, unknown>)[c.key as string];
                    return (
                      <td key={String(c.key)} className={`px-4 py-3 ${c.className ?? ""}`}>
                        {raw as React.ReactNode}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconBtn label="Editar" onClick={() => onEdit(row.id)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      {onAddDevengado && (
                        <IconBtn label="Devengado" onClick={() => onAddDevengado(row.id)}>
                          <CirclePlus className="h-4 w-4 text-emerald-400" />
                        </IconBtn>
                      )}
                      {onAddDeduccion && (
                        <IconBtn label="Deducción" onClick={() => onAddDeduccion(row.id)}>
                          <CircleMinus className="h-4 w-4 text-red-400" />
                        </IconBtn>
                      )}
                    </div>
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
            Página {page} de {totalPages} · {rows.length} registros
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
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 text-neutral-300 transition hover:bg-[var(--color-surface-2)] hover:text-white"
    >
      {children}
    </button>
  );
}

export const fmtCOP = formatCOP;
