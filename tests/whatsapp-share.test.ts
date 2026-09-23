import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicShareUrl,
  shareMessage,
  whatsappLink,
} from "../lib/whatsapp-share";
test("Sharing blocks local URLs, credentials and placeholder domains", () => {
  for (const url of [
    "http://localhost:3001/treino/x",
    "https://127.0.0.1/treino/x",
    "https://192.168.1.1/treino/x",
    "javascript:alert(1)",
    "https://user:pass@site.com/treino/x",
    "https://example.com/treino/x",
    "https://studio.local/treino/x",
  ])
    assert.equal(isPublicShareUrl(url), false, url);
  assert.equal(isPublicShareUrl("https://studio.vercel.app/treino/abc"), true);
});
test("Group message excludes personal data and individual link encodes text safely", () => {
  const message = shareMessage(8, "https://studio.vercel.app/treino/abc");
  assert.match(message, /Olá, pessoal!/);
  assert.match(message, /semana 8/);
  const individual = shareMessage(
    8,
    "https://studio.vercel.app/treino/abc",
    "Ana & João",
  );
  const link = new URL(whatsappLink(individual, "+5511999999999"));
  assert.equal(link.hostname, "wa.me");
  assert.equal(link.pathname, "/5511999999999");
  assert.equal(link.searchParams.get("text"), individual);
  assert.equal(new URL(whatsappLink(message)).pathname, "/");
  assert.throws(() => whatsappLink(message, "javascript:bad"));
});
