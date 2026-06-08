import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const listDepoimentos = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const depoimentos = await prisma.depoimento.findMany({
      where: { status: "PUBLICADO" },
      orderBy: { created_at: "desc" },
    });

    return res.send(depoimentos);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar depoimentos.",
    });
  }
};
