export type FieldType = "text" | "email" | "tel" | "number" | "currency" | "select";

export type FieldOption = { value: string; label: string };

export type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: FieldOption[];
  colSpan?: 1 | 2;
};

export type PersonaRecord = Record<string, unknown> & { id: number };
