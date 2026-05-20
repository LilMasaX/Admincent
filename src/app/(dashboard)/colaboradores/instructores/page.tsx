"use client";
import PersonaPage from "@/components/colaboradores/PersonaPage";
import type { FieldConfig } from "@/components/colaboradores/types";

type Instructor = {
  id: number;
  nombre: string;
  email: string;
  documento: string;
  telefono: string;
  numero_cuenta: string;
  tipo_cuenta: "ahorros" | "corriente";
  banco: string;
};

const fields: FieldConfig[] = [
  { name: "nombre", label: "Nombre", type: "text", required: true, colSpan: 2 },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "documento", label: "Documento", type: "text", required: true },
  { name: "telefono", label: "Teléfono", type: "tel", required: true },
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

export default function InstructoresPage() {
  return (
    <PersonaPage<Instructor>
      title="Instructores"
      singular="instructor"
      endpoint="/api/nomina/instructores"
      fields={fields}
      columns={[
        { key: "nombre", label: "Nombre" },
        { key: "email", label: "Email" },
        { key: "documento", label: "Documento" },
        { key: "banco", label: "Banco" },
        { key: "tipo_cuenta", label: "Tipo cuenta" },
        { key: "numero_cuenta", label: "N° cuenta" },
      ]}
    />
  );
}
