"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import PersonaForm from "./PersonaForm";
import PersonaTable, { Column } from "./PersonaTable";
import ConceptosModal from "./ConceptosModal";
import { FieldConfig } from "./types";

export default function PersonaPage<T extends { id: number }>({
  title,
  endpoint,
  fields,
  columns,
  singular,
  showConceptos = false,
}: {
  title: string;
  endpoint: string;
  fields: FieldConfig[];
  columns: Column<T>[];
  singular: string;
  showConceptos?: boolean;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [conceptos, setConceptos] = useState<{
    id: number;
    type: "devengados" | "deducciones";
  } | null>(null);

  const fetchRows = useCallback(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
        else toast.error(data?.error ?? "No se pudo cargar");
      })
      .catch(() => toast.error("Error de red"));
  }, [endpoint]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-4 w-4" /> Agregar {singular}
        </button>
      </header>

      <PersonaTable
        rows={rows}
        columns={columns}
        onEdit={(id) => setEditId(id)}
        onAddDevengado={
          showConceptos ? (id) => setConceptos({ id, type: "devengados" }) : undefined
        }
        onAddDeduccion={
          showConceptos ? (id) => setConceptos({ id, type: "deducciones" }) : undefined
        }
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Agregar ${singular}`} size="lg">
        <PersonaForm
          fields={fields}
          endpoint={endpoint}
          submitLabel={`Crear ${singular}`}
          onSuccess={fetchRows}
          onClose={() => setAddOpen(false)}
        />
      </Modal>

      <Modal
        open={editId !== null}
        onClose={() => setEditId(null)}
        title={`Editar ${singular}`}
        size="lg"
      >
        <PersonaForm
          fields={fields}
          endpoint={endpoint}
          itemId={editId}
          submitLabel="Guardar cambios"
          onSuccess={fetchRows}
          onClose={() => setEditId(null)}
          onDelete={fetchRows}
        />
      </Modal>

      <ConceptosModal
        open={conceptos !== null}
        onClose={() => setConceptos(null)}
        trabajadorId={conceptos?.id ?? null}
        type={conceptos?.type ?? "devengados"}
      />
    </div>
  );
}
