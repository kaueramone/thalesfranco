export function isPublicShareUrl(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      host.includes(".") &&
      !["localhost", "example.com", "seu-dominio.com"].includes(host) &&
      !host.endsWith(".localhost") &&
      !host.endsWith(".local") &&
      !host.endsWith(".test") &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) &&
      !host.includes(":")
    );
  } catch {
    return false;
  }
}
export function shareMessage(week: number, url: string, name?: string) {
  return `${name ? `Olá, ${name}!` : "Olá, pessoal!"}\n\nO treino da semana ${week} está pronto.\nConfira a programação, assista aos vídeos e baixe o PDF:\n${url}\n\nThales Franco`;
}
export function whatsappLink(message: string, phone?: string) {
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error("WhatsApp inválido.");
  return `https://wa.me/${phone ? phone.slice(1) : ""}?text=${encodeURIComponent(message)}`;
}
