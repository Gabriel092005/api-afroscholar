import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function removerMembro(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, membroId } = req.params as { id: string; membroId: string };
    const { sub: usuarioId } = req.user;

    const [comunidade, usuario] = await Promise.all([
      prisma.community.findUnique({
        where: { id },
        select: { criadorId: true },
      }),
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { role: true },
      }),
    ]);

    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    const isSystemAdmin = usuario?.role === "ADMIN";
    const isCreator = comunidade.criadorId === usuarioId;

    if (!isSystemAdmin && !isCreator) {
      const membro = await prisma.communityMember.findUnique({
        where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
        select: { role: true },
      });
      if (membro?.role !== "ADMIN") {
        return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem remover membros." });
      }
    }

    const alvo = await prisma.communityMember.findUnique({
      where: { id: membroId },
      select: { usuarioId: true, role: true },
    });

    if (!alvo || alvo.usuarioId === comunidade.criadorId) {
      return res.status(400).send({ error: "Bad Request", message: "Não é possível remover o criador da comunidade." });
    }

    if (alvo.usuarioId === usuarioId) {
      return res.status(400).send({ error: "Bad Request", message: "Use 'Sair da comunidade' para remover-se a si próprio." });
    }

    await prisma.communityMember.delete({ where: { id: membroId } });

    const { io } = await import("@/server");
    io.to(`comunidade:${id}`).emit("membro_removido", { membroId, usuarioId: alvo.usuarioId });

    return res.send({ message: "Membro removido da comunidade." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao remover membro." });
  }
}
