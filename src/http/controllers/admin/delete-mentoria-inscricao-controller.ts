import { Prisma } from "@/generated/client";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const deleteMentoriaInscricao = async (req: FastifyRequest, res: FastifyReply) => {
  try {
    const { id } = req.params as { id: string };

    const inscricao = await prisma.mentoriaInscricao.findUnique({ where: { id } });
    if (!inscricao) {
      return res.status(404).send({ error: "Not Found", message: "Inscrição em mentoria não encontrada." });
    }

    await prisma.mentoriaInscricao.delete({ where: { id } });

    return res.status(200).send({ message: "Inscrição em mentoria eliminada com sucesso" });
  } catch (error) {
    req.log.error(error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).send({ error: "Not Found", message: "Inscrição em mentoria não encontrada." });
      }
      return res.status(500).send({
        error: "Internal Server Error",
        message: `Erro no banco de dados: ${error.code}`,
      });
    }

    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao eliminar inscrição em mentoria." });
  }
};
