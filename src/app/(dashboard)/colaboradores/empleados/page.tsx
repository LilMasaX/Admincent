"use client";
import PersonaPage from "@/components/colaboradores/PersonaPage";
import { fmtCOP } from "@/components/colaboradores/PersonaTable";
import type { FieldConfig } from "@/components/colaboradores/types";

type Empleado = {
  id: number;
  nombre: string;
  email: string;
  documento: string;
  telefono: string;
  cargo: string;
  salario: number;
  numero_cuenta: string;
  tipo_cuenta: "ahorros" | "corriente";
  banco: string;
};

const fields: FieldConfig[] = [
  { name: "nombre", label: "Nombre", type: "text", required: true, colSpan: 2 },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "documento", label: "Documento", type: "text", required: true },
  { name: "telefono", label: "Teléfono", type: "tel", required: true },
  { name: "cargo", label: "Cargo", type: "text", required: true },
  { name: "salario", label: "Salario", type: "currency", required: true },
  {
    name: "tipo_cuenta",
    label: "Tipo de cuenta",
    type: "select",
    required: true,
    options: [
      { value: "ahorros", label: "Ahorros" },
      { value: "corriente", label: "Corriente" },
    ],
  },
  { name: "numero_cuenta", label: "Número de cuenta", type: "text", required: true },
  { name: "banco", label: "Banco", type: "text", required: true, colSpan: 2 },
];

export default function EmpleadosPage() {
  return (
    <PersonaPage<Empleado>
      title="Empleados"
      singular="empleado"
      endpoint="/api/nomina/trabajadores"
      fields={fields}
      showConceptos
      columns={[
        { key: "nombre", label: "Nombre" },
        { key: "email", label: "Email" },
        { key: "documento", label: "Documento" },
        { key: "salario", label: "Salario", render: (r) => fmtCOP(r.salario) },
        { key: "banco", label: "Banco" },
        { key: "tipo_cuenta", label: "Tipo cuenta" },
        { key: "numero_cuenta", label: "N° cuenta" },
      ]}
    />
  );
}
