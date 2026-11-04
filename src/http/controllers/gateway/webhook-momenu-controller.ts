import { env } from "@/Env";
import { confirmarPagamento, falharPagamento, registarFatura } from "@/lib/pagamentos-momenu";
import { FastifyReply, FastifyRequest } from "fastify";
import crypto from "node:crypto";

type MomenuWebhookBody = {
  event?: string;
  merchantTransactionId?: string;
  merchantReferenceId?: string;
  operationStatus?: string | number;
  invoiceUrl?: string;
};

const SEGREDO_PLACEHOLDER = "CHANGE_ME_WEBHOOK_SECRET";
const TOLERANCIA_TIMESTAMP_MS = 5 * 60 * 1000;
const ESTADOS_FALHADOS = new Set(["3", "4", "5"]);

export function webhookConfigurado(): boolean {
  const secret = env.MOMENU_WEBHOOK_SECRET;
  return Boolean(secret) && secret !== SEGREDO_PLACEHOLDER;
}

function cabecalho(req: FastifyRequest, nome: string): string | undefined {
  const valor = req.headers[nome];
  return Array.isArray(valor) ? valor[0] : valor;
}

function assinaturaValida(req: FastifyRequest): boolean {
  const provided = cabecalho(req, "x-webhook-signature");
  const timestamp = cabecalho(req, "x-webhook-timestamp");
  const raw = (req as { rawBody?: string }).rawBody;
  if (!provided || !timestamp || raw === undefined) return false;

  const enviadoEm = Date.parse(timestamp);
  if (Number.isNaN(enviadoEm) || Math.abs(Date.now() - enviadoEm) > TOLERANCIA_TIMESTAMP_MS) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", env.MOMENU_WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest("hex");

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export async function momenuWebhook(req: FastifyRequest, res: FastifyReply) {
  try {
    // Sem segredo não há como provar a origem: nunca aceitar o evento.
    if (!webhookConfigurado()) {
      req.log.error("MOMENU_WEBHOOK_SECRET não está configurado; webhook recusado");
      return res.status(503).send({ error: "Webhook not configured" });
    }

    if (!assinaturaValida(req)) {
      return res.status(401).send({ error: "Invalid signature" });
    }

    const body = (req.body ?? {}) as MomenuWebhookBody;
    const event = body.event ?? "";

    if (event === "webhook.test") {
      return res.send({ received: true, event, ignored: true });
    }

    const chave = {
      id: body.merchantReferenceId,
      transactionId: body.merchantTransactionId,
    };
    if (!chave.id && !chave.transactionId) {
      return res.status(400).send({ error: "Identificador da transação em falta" });
    }

    const estado = String(body.operationStatus ?? "");

    if (event === "payment.confirmed" || event === "invoice.created") {
      // O evento de fatura também prova o pagamento, caso o primeiro se tenha perdido.
      const confirmado = await confirmarPagamento(chave, body.invoiceUrl);
      if (body.invoiceUrl) await registarFatura(chave, body.invoiceUrl);
      return res.send({ received: true, event, confirmado });
    }

    // Os eventos de cancelamento, falha e erro chegam sem o campo "event".
    if (!event && ESTADOS_FALHADOS.has(estado)) {
      const falhado = await falharPagamento(chave);
      return res.send({ received: true, operationStatus: estado, falhado });
    }

    return res.send({ received: true, event, ignored: true });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error" });
  }
}
