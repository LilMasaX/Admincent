export type Participante = { nombre: string; cedula?: string };

// Parses CSV with header row. Accepts comma or semicolon. Required column: nombre.
export function parseParticipantesCsv(text: string): Participante[] {
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length === 0) return [];

  const sep = rows[0].includes(";") && !rows[0].includes(",") ? ";" : ",";
  const header = rows[0].split(sep).map((c) => c.trim().toLowerCase());
  const iNombre = header.indexOf("nombre");
  const iCedula = header.findIndex((c) => c === "cedula" || c === "cédula" || c === "documento");
  if (iNombre < 0) {
    throw new Error("CSV debe tener columna 'nombre'");
  }

  const out: Participante[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = parseCsvLine(rows[i], sep);
    const nombre = (cols[iNombre] ?? "").trim();
    if (!nombre) continue;
    const cedula = iCedula >= 0 ? (cols[iCedula] ?? "").trim() : undefined;
    out.push({ nombre, ...(cedula ? { cedula } : {}) });
  }
  return out;
}

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === sep) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}
