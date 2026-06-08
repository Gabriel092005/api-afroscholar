import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMinhasInscricoes = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const userId = (req.user as any).sub;

    if (!userId) {
      return res.status(401).send({
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
    }

    const { status } = req.query as { status?: string };

    const where: any = {
      usuarioId: userId,
    };

    if (status) {
      where.status = status;
    }

    const inscricoes = await prisma.bolsaInscricao.findMany({
      where,
      include: {
        bolsa: true,
      },
      orderBy: { created_at: "desc" },
    });

    return res.send(inscricoes);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar inscrições.",
    });
  }
};