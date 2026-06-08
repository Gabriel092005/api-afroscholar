import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listarSolicitacoes(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const admin = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem ver solicitações." });
    }

    const solicitacoes = await prisma.communityMember.findMany({
      where: { comunidadeId: id, status: "PENDENTE" },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, image_path: true },
        },
      },
      orderBy: { joined_at: "desc" },
    });

    return res.send(solicitacoes);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao listar solicitações." });
  }
}
