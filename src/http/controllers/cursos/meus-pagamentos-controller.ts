import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listMeusPagamentos = async (
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

    const pagamentos = await prisma.cursoPagamento.findMany({
      where: {
        usuarioId: userId,
      },
      include: {
        curso: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            preco: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return res.send(pagamentos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar pagamentos.",
    });
  }
};