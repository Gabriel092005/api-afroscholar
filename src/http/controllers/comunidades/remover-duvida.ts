import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function removerDuvida(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, duvidaId } = req.params as { id: string; duvidaId: string };
    const { sub: usuarioId } = req.user;

    const duvida = await prisma.communityQuestion.findUnique({
      where: { id: duvidaId },
    });

    if (!duvida) {
      return res.status(404).send({ error: "Not Found", message: "Dúvida não encontrada." });
    }

    if (duvida.comunidadeId !== id) {
      return res.status(400).send({ error: "Bad Request", message: "Dúvida não pertence a esta comunidade." });
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

    const isOwner = duvida.usuarioId === usuarioId;
    const isSystemAdmin = usuario?.role === "ADMIN";
    const isCommunityAdmin = membro?.role === "ADMIN";

    if (!isOwner && !isSystemAdmin && !isCommunityAdmin) {
      return res.status(403).send({ error: "Forbidden", message: "Não tem permissão para remover esta dúvida." });
    }

    await prisma.communityQuestion.delete({ where: { id: duvidaId } });

    return res.send({ message: "Dúvida removida com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover dúvida." });
  }
}
