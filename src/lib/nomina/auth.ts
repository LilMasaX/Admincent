import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    } as const;
  }
  return { session, response: null } as const;
}
