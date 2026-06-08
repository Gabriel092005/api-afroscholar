import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const aderirCursoSchema = z.object({
  metodo: z.string().optional(),
  referencia: z.string().optional(),
  comprovativo: z.string().optional(),
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

    const body = aderirCursoSchema.parse(req.body);

    const curso = await prisma.curso.findUnique({
      where: { id },
    });

    if (!curso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    const pagamentoExistente = await prisma.cursoPagamento.findUnique({
      where: {
        cursoId_usuarioId: {
          cursoId: id,
          usuarioId: userId,
        },
      },
    });

    if (pagamentoExistente && pagamentoExistente.status === "APROVADO") {
      return res.status(400).send({
        error: "Bad Request",
        message: "Você já possui este curso.",
      });
    }

    if (pagamentoExistente && pagamentoExistente.status === "PENDENTE") {
      return res.status(400).send({
        error: "Bad Request",
        message: "Pagamento já está em análise.",
      });
    }

    const pagamento = await prisma.cursoPagamento.upsert({
      where: {
        cursoId_usuarioId: {
          cursoId: id,
          usuarioId: userId,
        },
      },
      update: {
        metodo: body.metodo,
        referencia: body.referencia,
        comprovativo: body.comprovativo,
        status: "PENDENTE",
      },
      create: {
        cursoId: id,
        usuarioId: userId,
        valor: curso.preco,
        metodo: body.metodo,
        referencia: body.referencia,
        comprovativo: body.comprovativo,
      },
    });

    return res.status(201).send({
      id: pagamento.id,
      status: pagamento.status,
      message: "Pagamento enviado para análise",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        issues: error.format(),
      });
    }
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao processar pagamento.",
    });
  }
};