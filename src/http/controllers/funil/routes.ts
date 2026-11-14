import { FastifyInstance } from "fastify";
import { executarFunil, funilAtivo, lerTokenCancelamento } from "@/lib/funil-emails";
import { emailEstaConfigurado } from "@/lib/mail";
import prisma from "@/lib/prisma";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";

function paginaSimples(titulo: string, texto: string) {
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;">
<div style="max-width:420px;background:#fff;border-radius:12px;padding:28px 24px;text-align:center;">
<p style="margin:0 0 8px;font-weight:bold;color:#059669;">Afroscholars</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${titulo}</h1>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">${texto}</p></div></body></html>`;
}

export async function funilRoutes(fastify: FastifyInstance) {
  const apenasAdmin = { onRequest: [verifyJWT, verifyUserRole("ADMIN")] };

  /** Link do rodapé dos emails: cancela sem precisar de sessão. */
  const cancelar = async (token: string | undefined) => {
    const usuarioId = token ? lerTokenCancelamento(token) : null;
    if (!usuarioId) return false;
    const r = await prisma.user.updateMany({ where: { id: usuarioId }, data: { recebeEmailsMarketing: false } });
    return r.count > 0;
  };

  fastify.get("/emails/cancelar", async (req, res) => {
    const ok = await cancelar((req.query as { token?: string }).token);
    res.type("text/html; charset=utf-8");
    return ok
      ? res.send(paginaSimples("Subscrição cancelada", "Não voltará a receber os nossos emails promocionais. Os emails da sua conta (pagamentos, acesso) continuam a chegar."))
      : res.status(400).send(paginaSimples("Link inválido", "Este link já não é válido. Pode gerir as preferências nas definições da sua conta."));
  });

  /** One-click (cabeçalho List-Unsubscribe-Post) usado pelo Gmail e outros. */
  fastify.post("/emails/cancelar", async (req, res) => {
    const ok = await cancelar((req.query as { token?: string }).token);
    return res.status(ok ? 200 : 400).send({ ok });
  });

  /** Estado do funil e o que saiu nos últimos 30 dias, por gatilho. */
  fastify.get("/admin/funil/resumo", apenasAdmin, async (_req, res) => {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [porGatilho, cancelados, ultimo] = await Promise.all([
      prisma.emailFunil.groupBy({ by: ["gatilho"], where: { enviadoEm: { gte: desde } }, _count: { _all: true } }),
      prisma.user.count({ where: { recebeEmailsMarketing: false } }),
      prisma.emailFunil.findFirst({ orderBy: { enviadoEm: "desc" }, select: { enviadoEm: true } }),
    ]);
    return res.send({
      ativo: funilAtivo(),
      emailConfigurado: emailEstaConfigurado(),
      horario: "Todos os dias às 08:00 (Luanda)",
      enviados30Dias: Object.fromEntries(porGatilho.map((g) => [g.gatilho, g._count._all])),
      cancelados,
      ultimoEnvio: ultimo?.enviadoEm ?? null,
    });
  });

  /** Mostra quantos emails sairiam hoje, sem enviar nada. */
  fastify.post("/admin/funil/simular", apenasAdmin, async (req, res) => {
    try {
      return res.send(await executarFunil({ simulacao: true }));
    } catch (erro) {
      req.log.error(erro);
      return res.status(500).send({ message: "Erro ao simular o funil." });
    }
  });

  /** Corre o funil agora (respeita os mesmos limites: um email por pessoa por dia). */
  fastify.post("/admin/funil/executar", apenasAdmin, async (req, res) => {
    if (!emailEstaConfigurado()) {
      return res.status(400).send({ message: "O envio de email não está configurado no servidor (SMTP)." });
    }
    try {
      return res.send(await executarFunil());
    } catch (erro) {
      req.log.error(erro);
      return res.status(500).send({ message: "Erro ao executar o funil." });
    }
  });
}
