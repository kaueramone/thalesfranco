import { NextResponse } from "next/server";
import { authorize, fail, appUrl } from "@/lib/server";
import { eligible, workoutSchema, type Student } from "@/lib/model";
import { workoutPdf } from "@/lib/pdf";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({
  publicationId: z.uuid(),
  studentId: z.uuid(),
  channel: z.enum(["email", "whatsapp"]),
});
export async function POST(req: Request) {
  try {
    const { db, user } = await authorize(req);
    const input = schema.parse(await req.json());
    const [{ data: pub }, { data: student }] = await Promise.all([
      db
        .from("publications")
        .select("*")
        .eq("id", input.publicationId)
        .eq("owner_id", user.id)
        .eq("revoked", false)
        .single(),
      db
        .from("students")
        .select("*")
        .eq("id", input.studentId)
        .eq("owner_id", user.id)
        .single(),
    ]);
    if (!pub || !student) throw new Error("Treino ou aluno não encontrado.");
    if (!eligible(student as Student, input.channel))
      throw new Error("Aluno inativo ou sem autorização para este canal.");
    const url = `${appUrl()}/treino/${pub.token}`;
    const w = workoutSchema.parse(pub.content);
    if (
      input.channel === "email" &&
      !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    )
      throw new Error("Configure o Resend e o remetente antes de enviar.");
    if (
      input.channel === "whatsapp" &&
      !(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_GRAPH_VERSION &&
        process.env.WHATSAPP_TEMPLATE_NAME
      )
    )
      throw new Error("Configure a API da Meta e o template antes de enviar.");
    // Prepare expensive data before claiming: a PDF failure must not leave a locked delivery.
    const attachment =
      input.channel === "email" ? await workoutPdf(w, url) : null;
    let { data: delivery, error } = await db
      .from("deliveries")
      .insert({
        owner_id: user.id,
        publication_id: pub.id,
        student_id: student.id,
        channel: input.channel,
      })
      .select("id,status")
      .single();
    if (error?.code === "23505") {
      const { data: existing } = await db
        .from("deliveries")
        .select("id,status")
        .eq("publication_id", pub.id)
        .eq("student_id", student.id)
        .eq("channel", input.channel)
        .single();
      if (existing?.status === "failed") {
        const retried = await db
          .from("deliveries")
          .update({
            status: "processing",
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("status", "failed")
          .select("id,status")
          .maybeSingle();
        delivery = retried.data;
      } else
        return NextResponse.json({
          status: existing?.status || "processing",
          duplicate: true,
        });
    } else if (error) throw new Error("Não foi possível registrar o envio.");
    if (!delivery)
      return NextResponse.json({ status: "processing", duplicate: true });
    let status = "uncertain",
      providerId: string | null = null,
      reason: string | null = null;
    try {
      let response: Response;
      if (input.channel === "email")
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(25000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": delivery.id,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [student.email],
            subject: `Seu treino da semana ${w.week} | Thales Franco`,
            text: `Olá, ${student.name}!\n\nSeu treino da semana ${w.week} está pronto.\nAbra o treino e assista às demonstrações: ${url}\n\nO PDF está em anexo.\nThales Franco`,
            attachments: [
              {
                filename: `semana-${w.week}.pdf`,
                content: attachment!.toString("base64"),
              },
            ],
          }),
        });
      else
        response = await fetch(
          `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            signal: AbortSignal.timeout(25000),
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: student.whatsapp.replace("+", ""),
              type: "template",
              template: {
                name: process.env.WHATSAPP_TEMPLATE_NAME,
                language: {
                  code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR",
                },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: student.name },
                      { type: "text", text: String(w.week) },
                      { type: "text", text: url },
                    ],
                  },
                ],
              },
            }),
          },
        );
      const result = await response.json();
      if (response.ok) {
        status = "accepted";
        providerId = result.id || result.messages?.[0]?.id || null;
      } else {
        status = response.status >= 500 ? "uncertain" : "failed";
        reason = `Provedor respondeu HTTP ${response.status}. Verifique o painel do ${input.channel === "email" ? "Resend" : "WhatsApp Business"}.`;
      }
    } catch {
      reason =
        "Sem confirmação do provedor. Verifique o painel antes de reenviar para evitar duplicidade.";
    }
    const updated = await db
      .from("deliveries")
      .update({
        status,
        provider_id: providerId,
        error: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);
    if (updated.error)
      return NextResponse.json({
        status: "uncertain",
        error:
          "Envio processado; não foi possível atualizar o histórico. Verifique o provedor.",
      });
    return NextResponse.json({ status, error: reason });
  } catch (e) {
    return fail(e);
  }
}
