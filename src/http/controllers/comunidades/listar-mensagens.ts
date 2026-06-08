import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarMensagens(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const membro = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!membro) {
      return res.status(403).send({ error: "Forbidden", message: "Não é membro desta comunidade." });
    }

    const mensagens = await prisma.communityMessage.findMany({
      where: { comunidadeId: id },
      orderBy: { created_at: "asc" },
      take: 100,
      include: {
        usuario: {
          select: { id: true, nome: true, image_path: true },
        },
      },
    });

    return res.send(mensagens);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar mensagens." });
  }
}
