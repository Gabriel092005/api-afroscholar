import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export async function buscar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;

    const comunidade = await prisma.community.findUnique({
      where: { id },
      include: {
        _count: { select: { membros: { where: { status: "APROVADO" } }, mensagens: true } },
        membros: {
          where: { usuarioId },
          select: { role: true, status: true },
        },
        criador: {
          select: { id: true, nome: true, image_path: true },
        },
        bolsa: {
          select: { id: true, titulo: true },
        },
      },
    });

    if (!comunidade) {
      return res.status(404).send({ error: "Not Found", message: "Comunidade não encontrada." });
    }

    return res.send({
      ...comunidade,
      souMembro: comunidade.membros.some((m) => m.status === "APROVADO"),
      solicitacaoPendente: comunidade.membros.some((m) => m.status === "PENDENTE"),
      meuPapel: comunidade.membros.find((m) => m.status === "APROVADO")?.role || null,
      membros: undefined,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao buscar comunidade." });
  }
}
