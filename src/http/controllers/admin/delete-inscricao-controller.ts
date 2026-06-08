import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteInscricao = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const inscricao = await prisma.bolsaInscricao.findUnique({ where: { id } });
    if (!inscricao) {
      return res.status(404).send({ error: "Not Found", message: "Inscrição não encontrada." });
    }

    await prisma.bolsaInscricao.delete({ where: { id } });

    return res.status(200).send({ message: "Inscrição eliminada com sucesso" });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).send({ error: "Not Found", message: "Inscrição não encontrada." });
      }
      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code}`,
      });
    }

    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao eliminar inscrição." });
  }
};
