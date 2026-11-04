// Envia um evento webhook.test assinado para a API local, como a MoMenu faria. Não altera dados.
// Uso (na pasta api): node scripts/testar-webhook-momenu.cjs [url]
const crypto = require("node:crypto");
const fs = require("node:fs");

const url = process.argv[2] || "http://localhost:3333/webhooks/momenu";
const linha = fs
  .readFileSync(".env.dev", "utf8")
  .split(/\r?\n/)
  .find((l) => /^\s*MOMENU_WEBHOOK_SECRET\s*=/.test(l));
const segredo = (linha || "").split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");

if (!segredo || segredo === "CHANGE_ME_WEBHOOK_SECRET") {
  console.error("Defina MOMENU_WEBHOOK_SECRET no .env.dev e reinicie a API.");
  process.exit(1);
}

const corpo = JSON.stringify({
  event: "webhook.test",
  test: true,
  operationStatus: "test",
  merchantTransactionId: `TEST-${Date.now()}`,
});
const timestamp = new Date().toISOString();
const assinatura = crypto.createHmac("sha256", segredo).update(`${timestamp}.${corpo}`).digest("hex");

async function enviar(descricao, cabecalhos) {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-timestamp": timestamp, ...cabecalhos },
    body: corpo,
  });
  console.log(`${descricao}: HTTP ${resposta.status} ${await resposta.text()}`);
  return resposta.status;
}

(async () => {
  const valida = await enviar("Assinatura válida (esperado 200)", { "x-webhook-signature": assinatura });
  const invalida = await enviar("Assinatura errada (esperado 401)", { "x-webhook-signature": "0".repeat(64) });
  const certo = valida === 200 && invalida === 401;
  console.log(certo ? "Webhook local OK." : "O webhook local não respondeu como esperado.");
  process.exit(certo ? 0 : 1);
})().catch((erro) => {
  console.error("Não foi possível contactar a API:", erro.message);
  process.exit(1);
});
