import crypto from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  iniciarCobranca,
  metodoPagamentoSchema,
  responderErroPagamento,
  serializarPagamento,
  telefoneSchema,
} from "@/lib/pagamentos-momenu";
import prisma from "@/lib/prisma";

const bodySchema = z.object({
  metodo: metodoPagamentoSchema.optional(),
  phoneNumber: telefoneSchema.optional(),
});

export const comprarDocumento = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;
    const body = bodySchema.parse(req.body ?? {});

    const documento = await prisma.documento.findUnique({ where: { id } });
    if (!documento || documento.status !== "PUBLICADO") {
      return res.status(404).send({ error: "Not Found", message: "Documento não encontrado." });
    }
    if (documento.preco <= 0) {
      return res.status(400).send({ error: "Bad Request", message: "Este documento é gratuito." });
    }
    if (documento.criadoPorId === userId) {
      return res.status(400).send({ error: "Bad Request", message: "Este documento é seu: não precisa de o comprar." });
    }

    const chave = { documentoId_usuarioId: { documentoId: id, usuarioId: userId } };
    const existente = await prisma.documentoCompra.findUnique({ where: chave });
    if (existente?.status === "APROVADO") {
      return res.status(400).send({ error: "Bad Request", message: "Já comprou este documento." });
    }

    const alvoId = existente?.id ?? crypto.randomUUID();

    const pagamento = await iniciarCobranca({
      tipo: "DOCUMENTO",
      itemId: id,
      alvoId,
      usuarioId: userId,
      valor: documento.preco,
      metodo: body.metodo,
      phoneNumber: body.phoneNumber,
      produto: documento.titulo,
      link: "/documentos",
      persistirAlvo: (tx, cobranca) =>
        tx.documentoCompra.upsert({
          where: chave,
          update: {
            valor: documento.preco,
            metodo: cobranca.metodo,
            referencia: cobranca.referencia,
            comprovativo: null,
            status: "PENDENTE",
          },
          create: {
            id: alvoId,
            documentoId: id,
            usuarioId: userId,
            valor: documento.preco,
            metodo: cobranca.metodo,
            referencia: cobranca.referencia,
            status: "PENDENTE",
          },
        }),
    });

    return res.status(201).send({
      id: alvoId,
      pagamento: serializarPagamento(pagamento),
      message: pagamento.status === "PAGO" ? "Pagamento confirmado." : "Pagamento iniciado.",
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
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao processar pagamento.",
    });
  }
};
