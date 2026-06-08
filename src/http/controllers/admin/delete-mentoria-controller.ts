import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteMentoria = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const mentoria = await prisma.mentoria.findUnique({ where: { id } });
    if (!mentoria) {
      return res.status(404).send({ error: "Not Found", message: "Mentoria não encontrada." });
    }

    await prisma.mentoria.delete({ where: { id } });

    return res.status(200).send({ message: "Mentoria eliminada com sucesso" });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(409).send({
          error: "Conflict",
          message: "Não foi possível eliminar a mentoria pois existem inscrições vinculadas.",
        });
      }
      if (error.code === "P2025") {
        return res.status(404).send({ error: "Not Found", message: "Mentoria não encontrada." });
      }
      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code}`,
      });
    }

    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao eliminar mentoria." });
  }
};
