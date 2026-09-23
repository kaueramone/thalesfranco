import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authorize, fail, appUrl, uuid } from "@/lib/server";
import { workoutSchema } from "@/lib/model";
export async function POST(req: Request) {
  try {
    const { db, user } = await authorize(req);
    const { workoutId } = await req.json();
    if (!uuid.test(workoutId)) throw new Error("Treino inválido.");
    const { data: row, error } = await db
      .from("workouts")
      .select("content")
      .eq("id", workoutId)
      .eq("owner_id", user.id)
      .single();
    if (error || !row) throw new Error("Treino não encontrado.");
    const content = workoutSchema.parse(row.content);
    if (
      !content.days.some(
        (d) => d.rest || d.blocks.some((b) => b.exercises.length),
      )
    )
      throw new Error("Adicione exercícios antes de publicar.");
    const hash = createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex");
    let { data: pub } = await db
      .from("publications")
      .select("id,token,revoked")
      .eq("workout_id", workoutId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (!pub) {
      const inserted = await db
        .from("publications")
        .insert({
          workout_id: workoutId,
          owner_id: user.id,
          title: content.title,
          content,
          content_hash: hash,
        })
        .select("id,token,revoked")
        .single();
      if (inserted.error?.code === "23505") {
        const existing = await db
          .from("publications")
          .select("id,token,revoked")
          .eq("workout_id", workoutId)
          .eq("content_hash", hash)
          .single();
        pub = existing.data;
      } else if (inserted.error) throw new Error("Não foi possível publicar.");
      else pub = inserted.data;
    }
    if (!pub || pub.revoked)
      throw new Error(
        "Esta versão foi revogada. Edite o treino para gerar uma nova publicação.",
      );
    return NextResponse.json({
      id: pub.id,
      url: `${appUrl()}/treino/${pub.token}`,
      pdfUrl: `/api/pdf/${pub.token}`,
    });
  } catch (e) {
    return fail(e);
  }
}
