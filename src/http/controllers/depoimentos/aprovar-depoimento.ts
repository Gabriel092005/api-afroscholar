import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

export const aprovarDepoimento = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: "PUBLICADO" | "RASCUNHO" };

    const depoimento = await prisma.depoimento.findUnique({ where: { id } });
    if (!depoimento) {
      return res.status(404).send({ error: "Not Found", message: "Depoimento não encontrado." });
    }

    const updated = await prisma.depoimento.update({
      where: { id },
      data: { status },
    });

    return res.send(updated);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao atualizar depoimento.",
    });
  }
};
