import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function nextComprobanteNumber(): Promise<number> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("next_comprobante");
  if (error) throw new Error(`comprobante counter failed: ${error.message}`);
  return Number(data);
}
