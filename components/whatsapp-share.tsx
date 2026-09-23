"use client";
import { useState } from "react";
import { Copy, MessageCircle, Share2, Loader2 } from "lucide-react";
import { api } from "@/lib/supabase";
import { eligible, type Student } from "@/lib/model";
import {
  isPublicShareUrl,
  shareMessage,
  whatsappLink,
} from "@/lib/whatsapp-share";
export default function WhatsAppShare({
  workoutId,
  week,
  students,
  demo,
}: {
  workoutId: string;
  week: number;
  students: Student[];
  demo: boolean;
}) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [nativeShare, setNativeShare] = useState(false);
  const publicUrl = isPublicShareUrl(url);
  const message = shareMessage(week, url);
  async function prepare() {
    setBusy(true);
    setNotice("");
    try {
      if (demo)
        throw new Error(
          "Entre com a conta do Thales para publicar um link real.",
        );
      const result = await api("/api/publish", { workoutId });
      setUrl(result.url);
      setNativeShare(typeof navigator.share === "function");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível preparar o link.",
      );
    } finally {
      setBusy(false);
    }
  }
  function opened() {
    setNotice(
      "WhatsApp aberto. Escolha o destino e confirme o envio lá. O sistema não confirma envio ou entrega.",
    );
  }
  return (
    <div className="modal-body whatsapp-share">
      <p className="muted">
        Compartilhe no grupo ou com um aluno. A mensagem fica pronta; você
        confirma o envio no WhatsApp, sem contratar uma API.
      </p>
      {!url ? (
        <button className="btn primary" disabled={busy} onClick={prepare}>
          {busy ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <MessageCircle size={16} />
          )}{" "}
          Preparar link do treino
        </button>
      ) : (
        <>
          <label>
            Mensagem para o grupo
            <textarea readOnly rows={8} value={message} />
          </label>
          {!publicUrl && (
            <p className="setup-note">
              Este link é local e não abre no celular dos alunos. Configure
              APP_URL com o endereço HTTPS público do site na Vercel e reinicie
              o servidor antes de compartilhar.
            </p>
          )}
          <div className="share-actions">
            <button
              className="btn secondary"
              disabled={!publicUrl}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                  setNotice(
                    "Mensagem copiada. Cole no grupo e confirme o envio no WhatsApp.",
                  );
                } catch {
                  setNotice(
                    "Não foi possível copiar automaticamente. Selecione e copie a mensagem acima.",
                  );
                }
              }}
            >
              <Copy size={16} /> Copiar mensagem
            </button>
            {publicUrl && (
              <a
                className="btn primary"
                href={whatsappLink(message)}
                target="_blank"
                rel="noreferrer"
                onClick={opened}
              >
                <MessageCircle size={16} /> Abrir WhatsApp
              </a>
            )}
            {publicUrl && nativeShare && (
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await navigator.share({ text: message });
                    setNotice(
                      "Compartilhamento encaminhado ao aplicativo. A entrega não é confirmada pelo sistema.",
                    );
                  } catch (e) {
                    if (!(e instanceof DOMException && e.name === "AbortError"))
                      setNotice(
                        "Use Copiar mensagem ou Abrir WhatsApp neste dispositivo.",
                      );
                  }
                }}
              >
                <Share2 size={16} /> Compartilhar…
              </button>
            )}
          </div>
          <p className="muted">
            No celular, escolha o WhatsApp na opção Compartilhar. No computador,
            você também pode copiar a mensagem e colar diretamente no grupo.
          </p>
          <h3>Conversas individuais</h3>
          <div className="recipient-list">
            {students
              .filter((s) => eligible(s, "whatsapp"))
              .map((s) => (
                <div className="recipient" key={s.id}>
                  <span>{s.name}</span>
                  {publicUrl ? (
                    <a
                      className="text-btn"
                      href={whatsappLink(
                        shareMessage(week, url, s.name),
                        s.whatsapp,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      onClick={opened}
                    >
                      Abrir conversa ↗
                    </a>
                  ) : (
                    <small>Aguardando link público</small>
                  )}
                </div>
              ))}
            {!students.some((s) => eligible(s, "whatsapp")) && (
              <p className="muted">
                Nenhum aluno ativo com WhatsApp autorizado. Você ainda pode
                compartilhar no grupo.
              </p>
            )}
          </div>
          <p className="muted">
            Aberturas e cópias não são registradas como mensagens enviadas no
            histórico.
          </p>
        </>
      )}
      {notice && (
        <p role="status" className="inline-notice">
          {notice}
        </p>
      )}
    </div>
  );
}
