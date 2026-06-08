import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteDepoimento = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };

    const depoimento = await prisma.depoimento.findUnique({
      where: { id },
    });

    if (!depoimento) {
      return res.status(404).send({
        error: "Not Found",
        message: "Depoimento não encontrado.",
      });
    }

    await prisma.depoimento.delete({ where: { id } });

    return res.status(200).send({ message: "Depoimento removido com sucesso." });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao remover depoimento.",
    });
  }
};
