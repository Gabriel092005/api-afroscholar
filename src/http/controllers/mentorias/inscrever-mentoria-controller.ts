import { concederMentoria, temMentoriaAtiva } from "@/lib/mentoria-acesso";
import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import {
  iniciarCobranca,
  metodoPagamentoSchema,
  responderErroPagamento,
  serializarPagamento,
  telefoneSchema,
} from "@/lib/pagamentos-momenu";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const inscreverSchema = z.object({
  metodoPagamento: metodoPagamentoSchema.optional(),
  phoneNumber: telefoneSchema.optional(),
});

export async function inscreverMentoria(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const usuarioId = req.user.sub;
    const body = inscreverSchema.parse(req.body ?? {});

    const mentoria = await prisma.mentoria.findUnique({ where: { id } });

    if (!mentoria) {
      return res.status(404).send({ error: "Not Found", message: "Mentoria não encontrada." });
    }

    const chave = { mentoriaId_usuarioId: { mentoriaId: id, usuarioId } };
    const existente = await prisma.mentoriaInscricao.findUnique({ where: chave });

    // Depois de terminar o mês, pode pagar de novo para renovar.
    if (existente?.status === "APROVADA" && (await temMentoriaAtiva(usuarioId, id))) {
      return res.send({ message: "Já está inscrito nesta mentoria." });
    }

    if (mentoria.preco <= 0) {
      const inscricao = await prisma.mentoriaInscricao.upsert({
        where: chave,
        update: { status: "APROVADA" },
        create: { mentoriaId: id, usuarioId, status: "APROVADA" },
      });
      await concederMentoria({ usuarioId, bolsaId: mentoria.bolsaId, mentoriaId: id, pago: false });
      return res.status(201).send({ id: inscricao.id, status: inscricao.status });
    }

    const alvoId = existente?.id ?? crypto.randomUUID();

    const pagamento = await iniciarCobranca({
      tipo: "MENTORIA",
      itemId: id,
      alvoId,
      usuarioId,
      valor: mentoria.preco,
      metodo: body.metodoPagamento,
      phoneNumber: body.phoneNumber,
      produto: mentoria.nome || "Mentoria",
      link: "/mentorias",
      persistirAlvo: (tx, cobranca) =>
        tx.mentoriaInscricao.upsert({
          where: chave,
          update: {
            status: "PENDENTE",
            metodoPagamento: cobranca.metodo,
            referenciaPagamento: cobranca.referencia,
            comprovativoUrl: null,
          },
          create: {
            id: alvoId,
            mentoriaId: id,
            usuarioId,
            status: "PENDENTE",
            metodoPagamento: cobranca.metodo,
            referenciaPagamento: cobranca.referencia,
            comprovativoUrl: null,
          },
        }),
    });

    return res.status(201).send({
      id: alvoId,
      status: pagamento.status === "PAGO" ? "APROVADA" : "PENDENTE",
      pagamento: serializarPagamento(pagamento),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        message: error.issues[0]?.message,
        issues: error.format(),
      });
    }
    const resposta = responderErroPagamento(error, req, res);
    if (resposta) return resposta;

    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao inscrever na mentoria." });
  }
}
