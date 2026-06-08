import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const getInscricao = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req.user as any).sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    const inscricao = await prisma.bolsaInscricao.findFirst({
      where: {
        id,
        usuarioId: userId,
      },
      include: {
        bolsa: true,
      },
    });

    if (!inscricao) {
      return res.status(404).send({
        error: "Not Found",
        message: "Inscrição não encontrada.",
      });
    }

    return res.send(inscricao);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao buscar inscrição.",
    });
  }
};