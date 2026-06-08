import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const responderSchema = z.object({
  acao: z.enum(["APROVAR", "REJEITAR"]),
});

export async function responderSolicitacao(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, membroId } = req.params as { id: string; membroId: string };
    const { sub: usuarioId } = req.user;

    const admin = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem responder solicitações." });
    }

    const { acao } = responderSchema.parse(req.body);

    const solicitacao = await prisma.communityMember.findFirst({
      where: { id: membroId, comunidadeId: id, status: "PENDENTE" },
      include: { comunidade: true },
    });

    if (!solicitacao) {
      return res.status(404).send({ error: "Not Found", message: "Solicitação não encontrada." });
    }

    if (acao === "APROVAR") {
      await prisma.communityMember.update({
        where: { id: membroId },
        data: { status: "APROVADO" },
      });

      await prisma.notification.create({
        data: {
          titulo: `Aprovado em "${solicitacao.comunidade.nome}"`,
          content: `A sua solicitação para entrar em "${solicitacao.comunidade.nome}" foi aprovada.`,
          tipo: "INFO",
          link: `/comunidades/${id}`,
          entidade: "comunidade",
          entidadeId: id,
          userId: solicitacao.usuarioId,
        },
      });

      return res.send({ message: "Solicitação aprovada." });
    }

    await prisma.notification.create({
      data: {
        titulo: `Solicitação rejeitada em "${solicitacao.comunidade.nome}"`,
        content: `A sua solicitação para entrar em "${solicitacao.comunidade.nome}" foi rejeitada.`,
        tipo: "INFO",
        entidade: "comunidade",
        entidadeId: id,
        userId: solicitacao.usuarioId,
      },
    });

    await prisma.communityMember.delete({
      where: { id: membroId },
    });

    return res.send({ message: "Solicitação rejeitada." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao responder solicitação." });
  }
}
