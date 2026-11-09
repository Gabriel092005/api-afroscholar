import crypto from "node:crypto";
import { cursosComAcesso } from "@/lib/mentoria-acesso";
import { codigoAfiliadoDoPedido } from "@/lib/afiliados";
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

const aderirCursoSchema = z.object({
  metodo: metodoPagamentoSchema.optional(),
  phoneNumber: telefoneSchema.optional(),
});

export const aderirCurso = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req.user as any).sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    const body = aderirCursoSchema.parse(req.body ?? {});

    const curso = await prisma.curso.findUnique({
      where: { id },
    });

    if (!curso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    const chave = { cursoId_usuarioId: { cursoId: id, usuarioId: userId } };
    const existente = await prisma.cursoPagamento.findUnique({ where: chave });

    // O que veio com uma mentoria já terminada não conta: pode ser comprado.
    if (existente?.status === "APROVADO" && (await cursosComAcesso(userId)).has(id)) {
      return res.status(400).send({
        error: "Bad Request",
        message: "Você já possui este curso.",
      });
    }

    // Preço 0 num curso de bolsa não significa gratuito: o acesso vem da inscrição na bolsa.
    if (curso.bolsaId && curso.preco <= 0) {
      return res.status(403).send({
        error: "Forbidden",
        message: "Este curso está incluído numa bolsa. Inscreva-se na bolsa para ter acesso.",
      });
    }

    if (curso.preco <= 0) {
      const pagamento = await prisma.$transaction(async (tx) => {
        const aprovado = await tx.cursoPagamento.upsert({
          where: chave,
          update: { status: "APROVADO", valor: 0, metodo: "GRATUITO" },
          create: {
            cursoId: id,
            usuarioId: userId,
            valor: 0,
            metodo: "GRATUITO",
            status: "APROVADO",
          },
        });
        const matricula = { cursoId: id, usuarioId: userId };
        const jaMatriculado = await tx.cursoUsuario.findUnique({
          where: { cursoId_usuarioId: matricula },
        });
        if (!jaMatriculado) {
          await tx.cursoUsuario.create({ data: matricula });
          await tx.curso.update({
            where: { id },
            data: { estudantes: { increment: 1 } },
          });
        }
        return aprovado;
      });

      return res.status(201).send({
        id: pagamento.id,
        status: pagamento.status,
        message: "Curso gratuito adicionado.",
      });
    }

    // Pedidos antigos, com comprovativo manual, continuam à espera do administrador.
    if (existente?.status === "PENDENTE") {
      const temCobranca = await prisma.pagamentoMomenu.count({
        where: { tipo: "CURSO", alvoId: existente.id },
      });
      if (!temCobranca) {
        return res.status(400).send({
          error: "Bad Request",
          message: "Pagamento já está em análise.",
        });
      }
    }

    const alvoId = existente?.id ?? crypto.randomUUID();

    const pagamento = await iniciarCobranca({
      tipo: "CURSO",
      itemId: id,
      alvoId,
      usuarioId: userId,
      valor: curso.preco,
      metodo: body.metodo,
      phoneNumber: body.phoneNumber,
      produto: curso.titulo || "Curso",
      link: `/cursos/${id}`,
      afiliadoCodigo: codigoAfiliadoDoPedido(req),
      persistirAlvo: (tx, cobranca) =>
        tx.cursoPagamento.upsert({
          where: chave,
          update: {
            valor: curso.preco,
            metodo: cobranca.metodo,
            referencia: cobranca.referencia,
            comprovativo: null,
            status: "PENDENTE",
          },
          create: {
            id: alvoId,
            cursoId: id,
            usuarioId: userId,
            valor: curso.preco,
            metodo: cobranca.metodo,
            referencia: cobranca.referencia,
            comprovativo: null,
            status: "PENDENTE",
          },
        }),
    });

    const pago = pagamento.status === "PAGO";

    return res.status(201).send({
      id: alvoId,
      status: pago ? "APROVADO" : "PENDENTE",
      pagamento: serializarPagamento(pagamento),
      message: pago ? "Pagamento confirmado." : "Pagamento iniciado.",
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
