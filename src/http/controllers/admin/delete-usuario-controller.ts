import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteUsuario = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).send({ error: "Not Found", message: "Utilizador não encontrado." });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).send({ message: "Utilizador eliminado com sucesso" });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return res.status(409).send({
          error: "Conflict",
          message: "Não foi possível eliminar o utilizador pois existem registos vinculados.",
        });
      }
      if (error.code === "P2025") {
        return res.status(404).send({ error: "Not Found", message: "Utilizador não encontrado." });
      }
      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code}`,
      });
    }

    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao eliminar utilizador." });
  }
};
