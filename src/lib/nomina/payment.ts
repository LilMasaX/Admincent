export type ConceptoItem = {
  concepto: string;
  valor: number | string;
};

const toNumber = (v: number | string | null | undefined) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const sum = (items: ConceptoItem[]) =>
  items.reduce((acc, i) => acc + toNumber(i.valor), 0);

export function calculatePayment(
  devengados: ConceptoItem[],
  deducciones: ConceptoItem[],
  dbDevengados: ConceptoItem[] = [],
  dbDeducciones: ConceptoItem[] = [],
): number {
  return sum(devengados) + sum(dbDevengados) - sum(deducciones) - sum(dbDeducciones);
}

export const formatCOP = (value: number | string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
