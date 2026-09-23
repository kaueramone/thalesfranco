"use client";
import { useState } from "react";
import {
  Copy,
  MessageCircle,
  Share2,
  Loader2,
  Download,
  ExternalLink,
} from "lucide-react";
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
  const [pdfUrl, setPdfUrl] = useState("");
  const [downloading, setDownloading] = useState(false);
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
      setPdfUrl(result.pdfUrl);
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
  async function downloadPdf() {
    setDownloading(true);
    try {
      const response = await fetch(pdfUrl);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/pdf")
      )
        throw new Error("Não foi possível gerar o PDF. Tente novamente.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `thales-franco-semana-${week}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      setNotice(
        "PDF pronto para baixar. Anexe o arquivo e cole o link na conversa com os alunos.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Não foi possível baixar o PDF.",
      );
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="modal-body whatsapp-share">
      <p className="muted">
        Baixe o PDF e compartilhe a página com os alunos, sem login. A página
        permite assistir aos vídeos e baixar o treino. O PDF também inclui o
        link da página.
      </p>
      {!url ? (
        <button className="btn primary" disabled={busy} onClick={prepare}>
          {busy ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <MessageCircle size={16} />
          )}{" "}
          Gerar PDF e link público
        </button>
      ) : (
        <>
          <label>
            Link público · acesso sem login
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="share-actions">
            <button
              className="btn primary"
              disabled={!pdfUrl || downloading}
              onClick={downloadPdf}
            >
              {downloading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Download size={16} />
              )}
              {downloading ? "Gerando PDF…" : "Baixar PDF"}
            </button>
            <button
              className="btn secondary"
              disabled={!publicUrl}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setNotice("Link copiado. Os alunos podem abrir sem login.");
                } catch {
                  setNotice("Selecione e copie o link no campo acima.");
                }
              }}
            >
              <Copy size={16} /> Copiar link
            </button>
            {publicUrl && (
              <a
                className="btn secondary"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> Abrir página
              </a>
            )}
          </div>
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
