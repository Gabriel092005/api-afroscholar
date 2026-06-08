import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const removeAula = async (
  req: FastifyRequest<{ Params: { cursoId: string; aulaId: string } }>,
  res: FastifyReply
) => {
  try {
    const { cursoId, aulaId } = req.params;

    const existingAula = await prisma.aula.findFirst({
      where: { id: aulaId, cursoId },
    });

    if (!existingAula) {
      return res.status(404).send({
        error: "Not Found",
        message: "Aula não encontrada.",
      });
    }

    await prisma.aula.delete({
      where: { id: aulaId },
    });

    const curso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: { aulas: true },
    });

    if (curso) {
      await prisma.curso.update({
        where: { id: cursoId },
        data: { quantAulas: curso.aulas.length - 1 },
      });
    }

    return res.status(200).send({
      message: "Aula removida com sucesso",
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao remover aula.",
    });
  }
};
