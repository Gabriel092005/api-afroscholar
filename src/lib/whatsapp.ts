import jwt from "jsonwebtoken";
import { env } from "@/Env";

/**
 * WhatsApp para a equipa de atendimento.
 *
 * - Sem configuração: geramos links wa.me com a mensagem pronta e um link seguro (48h)
 *   para descarregar o PDF. O admin só tem de carregar em "Enviar".
 * - Com a WhatsApp Cloud API (Meta) configurada: o PDF é enviado automaticamente como
 *   documento, através de um modelo (template) aprovado com cabeçalho de documento e
 *   uma variável no corpo ({{1}} = resumo da mensagem).
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappApiConfigurada() {
  return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TEMPLATE_DOCUMENTO);
}

/** "923 456 789" ou "+244 923 456 789" → "244923456789". Devolve null se não parecer um número. */
export function normalizarNumero(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const digitos = telefone.replace(/\D/g, "");
  if (/^9\d{8}$/.test(digitos)) return `244${digitos}`;
  return digitos.length >= 9 ? digitos : null;
}

export function linkWhatsapp(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

// ─── Link seguro para o PDF (sem sessão, expira em 48h) ────────────

const TIPO_TOKEN_PDF = "pdf-contactos";

export function linkPdfContactos(dias: number) {
  const token = jwt.sign({ tipo: TIPO_TOKEN_PDF, dias }, env.JWT_SECRET, { expiresIn: "48h" });
  return `${env.API_URL}/atendimento/contactos.pdf?token=${encodeURIComponent(token)}`;
}

/** Devolve o período (dias) se o token for válido, ou null. */
export function lerTokenPdf(token: string): number | null {
  try {
    const dados = jwt.verify(token, env.JWT_SECRET) as { tipo?: string; dias?: number };
    return dados.tipo === TIPO_TOKEN_PDF && typeof dados.dias === "number" ? dados.dias : null;
  } catch {
    return null;
  }
}

// ─── WhatsApp Cloud API ────────────────────────────────────────────

async function chamarGraph(caminho: string, init: RequestInit) {
  const resposta = await fetch(`${GRAPH}/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, ...(init.headers ?? {}) },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!resposta.ok) throw new Error(corpo.error?.message ?? `WhatsApp respondeu ${resposta.status}`);
  return corpo;
}

async function carregarPdf(pdf: Buffer, nomeFicheiro: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), nomeFicheiro);
  const corpo = await chamarGraph(`${env.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: "POST", body: form });
  if (!corpo.id) throw new Error("O WhatsApp não devolveu o id do ficheiro.");
  return corpo.id;
}

/**
 * Envia o PDF a vários números com o modelo aprovado. O ficheiro é carregado uma vez.
 * Devolve quantos números receberam; os erros ficam registados por número.
 */
export async function enviarPdfWhatsapp(numeros: string[], pdf: Buffer, nomeFicheiro: string, resumo: string) {
  if (!whatsappApiConfigurada()) throw new Error("A API do WhatsApp não está configurada no servidor.");
  if (numeros.length === 0) return { enviados: 0, falhados: [] as string[] };

  const mediaId = await carregarPdf(pdf, nomeFicheiro);
  let enviados = 0;
  const falhados: string[] = [];
  for (const numero of numeros) {
    try {
      await chamarGraph(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "template",
          template: {
            name: env.WHATSAPP_TEMPLATE_DOCUMENTO,
            language: { code: env.WHATSAPP_TEMPLATE_IDIOMA },
            components: [
              { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename: nomeFicheiro } }] },
              // As variáveis dos modelos não aceitam quebras de linha nem muitos espaços seguidos.
              { type: "body", parameters: [{ type: "text", text: resumo.replace(/\s+/g, " ").slice(0, 1000) }] },
            ],
          },
        }),
      });
      enviados++;
    } catch (erro) {
      falhados.push(numero);
      console.error(`[whatsapp] falha ao enviar para ${numero}`, erro);
    }
  }
  return { enviados, falhados };
}
