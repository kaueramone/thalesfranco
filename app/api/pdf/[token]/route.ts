import { admin, appUrl, uuid } from "@/lib/server";
import { workoutPdf } from "@/lib/pdf";
import { workoutSchema } from "@/lib/model";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!uuid.test(token)) return new Response("Não encontrado", { status: 404 });
  try {
    const { data } = await admin()
      .from("publications")
      .select("content")
      .eq("token", token)
      .eq("revoked", false)
      .maybeSingle();
    if (!data) return new Response("Não encontrado", { status: 404 });
    const w = workoutSchema.parse(data.content);
    const pdf = await workoutPdf(w, `${appUrl()}/treino/${token}`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="thales-franco-semana-${w.week}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return new Response("Não foi possível gerar o PDF.", { status: 503 });
  }
}
