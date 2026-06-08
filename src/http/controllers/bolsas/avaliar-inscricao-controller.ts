import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { io } from "@/server";

const avaliarSchema = z.object({
  status: z.enum(["APROVADA", "REJEITADA"]),
  observacoes: z.string().optional(),
});

export const avaliarInscricao = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const body = avaliarSchema.parse(req.body);

    const inscricao = await prisma.bolsaInscricao.findUnique({
      where: { id },
      include: { bolsa: true },
    });

    if (!inscricao) {
      return res.status(404).send({
        error: "Not Found",
        message: "Inscrição não encontrada.",
      });
    }

    if (inscricao.status === "CANCELADA") {
      return res.status(400).send({
        error: "Bad Request",
        message: "Não é possível avaliar uma inscrição cancelada.",
      });
    }

    const atualizada = await prisma.bolsaInscricao.update({
      where: { id },
      data: {
        status: body.status,
        observacoes: body.observacoes || inscricao.observacoes,
      },
    });

    if (body.status === "APROVADA") {
      await prisma.notification.create({
        data: {
          titulo: "Inscrição Aprovada ✅",
          content: `Sua inscrição para "${inscricao.bolsa.titulo}" foi aprovada!`,
          tipo: "SUCESSO",
          link: `/admin/bolsas/${inscricao.bolsaId}`,
          entidade: "bolsa",
          entidadeId: inscricao.bolsaId,
          userId: inscricao.usuarioId,
        },
      });

      io?.to(inscricao.usuarioId).emit("nova_notificacao", {
        id: crypto.randomUUID(),
        titulo: "Inscrição Aprovada ✅",
        conteudo: `Sua inscrição para "${inscricao.bolsa.titulo}" foi aprovada!`,
        tipo: "SUCESSO",
        link: `/admin/bolsas/${inscricao.bolsaId}`,
        visualizada: false,
        created_at: new Date().toISOString(),
      });
    }

    if (body.status === "REJEITADA") {
      await prisma.notification.create({
        data: {
          titulo: "Inscrição Rejeitada ❌",
          content: `Sua inscrição para "${inscricao.bolsa.titulo}" foi rejeitada.${body.observacoes ? ` Motivo: ${body.observacoes}` : ""}`,
          tipo: "ERRO",
          link: `/admin/bolsas/${inscricao.bolsaId}`,
          entidade: "bolsa",
          entidadeId: inscricao.bolsaId,
          userId: inscricao.usuarioId,
        },
      });

      io?.to(inscricao.usuarioId).emit("nova_notificacao", {
        id: crypto.randomUUID(),
        titulo: "Inscrição Rejeitada ❌",
        conteudo: `Sua inscrição para "${inscricao.bolsa.titulo}" foi rejeitada.${body.observacoes ? ` Motivo: ${body.observacoes}` : ""}`,
        tipo: "ERRO",
        link: `/admin/bolsas/${inscricao.bolsaId}`,
        visualizada: false,
        created_at: new Date().toISOString(),
      });
    }

    return res.send({
      id: atualizada.id,
      status: atualizada.status,
      message: `Inscrição ${body.status.toLowerCase()} com sucesso`,
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
      message: "Erro ao avaliar inscrição.",
    });
  }
};