import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const getBolsa = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };

    const bolsa = await prisma.bolsa.findUnique({
      where: { id },
    });

    if (!bolsa) {
      return res.status(404).send({
        error: "Not Found",
        message: "Bolsa não encontrada.",
      });
    }

    return res.send(bolsa);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao buscar bolsa.",
    });
  }
};