"use client";
import PersonaPage from "@/components/colaboradores/PersonaPage";
import type { FieldConfig } from "@/components/colaboradores/types";

type Proveedor = {
  id: number;
  nombre: string;
  email: string;
  nit: string;
  telefono: string;
  numero_cuenta: string;
  tipo_cuenta: "ahorros" | "corriente";
  banco: string;
};

const fields: FieldConfig[] = [
  { name: "nombre", label: "Razón social", type: "text", required: true, colSpan: 2 },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "nit", label: "NIT", type: "text", required: true },
  { name: "telefono", label: "Teléfono", type: "tel", required: true, colSpan: 2 },
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

export default function ProveedoresPage() {
  return (
    <PersonaPage<Proveedor>
      title="Proveedores"
      singular="proveedor"
      endpoint="/api/nomina/proveedores"
      fields={fields}
      columns={[
        { key: "nombre", label: "Razón social" },
        { key: "email", label: "Email" },
        { key: "nit", label: "NIT" },
        { key: "banco", label: "Banco" },
        { key: "tipo_cuenta", label: "Tipo cuenta" },
        { key: "numero_cuenta", label: "N° cuenta" },
      ]}
    />
  );
}
