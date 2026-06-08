import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { io } from "@/server";

const avaliarSchema = z.object({
  status: z.enum(["APROVADO", "REJEITADO", "CANCELADO"]),
  observacoes: z.string().optional(),
});

export const avaliarPagamento = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const body = avaliarSchema.parse(req.body);

    const pagamento = await prisma.cursoPagamento.findUnique({
      where: { id },
      include: { curso: true },
    });

    if (!pagamento) {
      return res.status(404).send({
        error: "Not Found",
        message: "Pagamento não encontrado.",
      });
    }

    if (pagamento.status === "CANCELADO" || pagamento.status === "APROVADO") {
      return res.status(400).send({
        error: "Bad Request",
        message: `Pagamento já está ${pagamento.status.toLowerCase()}.`,
      });
    }

    const atualizada = await prisma.cursoPagamento.update({
      where: { id },
      data: {
        status: body.status,
        observacoes: body.observacoes || pagamento.observacoes,
      },
    });

    if (body.status === "APROVADO") {
      await prisma.curso.update({
        where: { id: pagamento.cursoId },
        data: {
          estudantes: { increment: 1 },
        },
      });

      await prisma.cursoUsuario.upsert({
        where: {
          cursoId_usuarioId: {
            cursoId: pagamento.cursoId,
            usuarioId: pagamento.usuarioId,
          },
        },
        create: {
          cursoId: pagamento.cursoId,
          usuarioId: pagamento.usuarioId,
        },
        update: {},
      });

      await prisma.notification.create({
        data: {
          titulo: "Pagamento Aprovado ✅",
          content: `O pagamento do curso "${pagamento.curso.titulo}" foi aprovado. Agora já pode acessar todo o conteúdo!`,
          tipo: "SUCESSO",
          link: `/cursos/${pagamento.cursoId}/aulas`,
          entidade: "curso",
          entidadeId: pagamento.cursoId,
          userId: pagamento.usuarioId,
        },
      });

      io?.to(pagamento.usuarioId).emit("nova_notificacao", {
        id: crypto.randomUUID(),
        titulo: "Pagamento Aprovado ✅",
        conteudo: `O pagamento do curso "${pagamento.curso.titulo}" foi aprovado!`,
        tipo: "SUCESSO",
        link: `/cursos/${pagamento.cursoId}/aulas`,
        visualizada: false,
        created_at: new Date().toISOString(),
      });
    }

    if (body.status === "REJEITADO") {
      await prisma.notification.create({
        data: {
          titulo: "Pagamento Rejeitado ❌",
          content: `O pagamento do curso "${pagamento.curso.titulo}" foi rejeitado.${body.observacoes ? ` Motivo: ${body.observacoes}` : ""}`,
          tipo: "ERRO",
          link: `/cursos/${pagamento.cursoId}`,
          entidade: "curso",
          entidadeId: pagamento.cursoId,
          userId: pagamento.usuarioId,
        },
      });

      io?.to(pagamento.usuarioId).emit("nova_notificacao", {
        id: crypto.randomUUID(),
        titulo: "Pagamento Rejeitado ❌",
        conteudo: `O pagamento do curso "${pagamento.curso.titulo}" foi rejeitado.${body.observacoes ? ` Motivo: ${body.observacoes}` : ""}`,
        tipo: "ERRO",
        link: `/cursos/${pagamento.cursoId}`,
        visualizada: false,
        created_at: new Date().toISOString(),
      });
    }

    return res.send({
      id: atualizada.id,
      status: atualizada.status,
      message: `Pagamento ${body.status.toLowerCase()} com sucesso`,
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
      message: "Erro ao avaliar pagamento.",
    });
  }
};