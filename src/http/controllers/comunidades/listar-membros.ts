import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarMembros(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };

    const membros = await prisma.communityMember.findMany({
      where: { comunidadeId: id, status: "APROVADO" },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, image_path: true },
        },
      },
      orderBy: { joined_at: "asc" },
    });

    return res.send(membros);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar membros." });
  }
}
