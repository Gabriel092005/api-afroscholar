import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function sair(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const membro = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!membro) {
      return res.status(400).send({ error: "Bad Request", message: "Não é membro desta comunidade." });
    }

    await prisma.communityMember.delete({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    return res.send({ message: "Saiu da comunidade." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao sair da comunidade." });
  }
}
