import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function removerMensagem(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, mensagemId } = req.params as { id: string; mensagemId: string };
    const { sub: usuarioId } = req.user;

    const mensagem = await prisma.communityMessage.findUnique({
      where: { id: mensagemId },
      include: {
        comunidade: {
          select: { criadorId: true },
        },
      },
    });

    if (!mensagem) {
      return res.status(404).send({ error: "Not Found", message: "Mensagem não encontrada." });
    }

    if (mensagem.comunidadeId !== id) {
      return res.status(400).send({ error: "Bad Request", message: "Mensagem não pertence a esta comunidade." });
    }

    const [usuario, membro] = await Promise.all([
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { role: true },
      }),
      prisma.communityMember.findUnique({
        where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
        select: { role: true },
      }),
    ]);

    const isOwner = mensagem.usuarioId === usuarioId;
    const isSystemAdmin = usuario?.role === "ADMIN";
    const isCreator = mensagem.comunidade.criadorId === usuarioId;
    const isCommunityAdmin = membro?.role === "ADMIN";

    if (!isOwner && !isSystemAdmin && !isCreator && !isCommunityAdmin) {
      return res.status(403).send({ error: "Forbidden", message: "Não tem permissão para remover esta mensagem." });
    }

    await prisma.communityMessage.delete({ where: { id: mensagemId } });

    const { io } = await import("@/server");
    io.to(`comunidade:${id}`).emit("mensagem_removida", mensagemId);

    return res.send({ message: "Mensagem removida com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover mensagem." });
  }
}
