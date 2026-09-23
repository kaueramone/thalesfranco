import { NextResponse } from "next/server";
import { authorize, fail, uuid } from "@/lib/server";
export async function POST(req: Request) {
  try {
    const { db, user } = await authorize(req);
    const { id } = await req.json();
    if (!uuid.test(id)) throw new Error("Publicação inválida.");
    const { error } = await db
      .from("publications")
      .update({ revoked: true })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (error) throw new Error("Falha ao revogar.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
