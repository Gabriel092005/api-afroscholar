import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const publishCurso = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  res: FastifyReply
) => {
  try {
    const { id } = req.params;

    const existingCurso = await prisma.curso.findUnique({
      where: { id },
      include: { aulas: true },
    });

    if (!existingCurso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    if (existingCurso.aulas.length === 0) {
      return res.status(400).send({
        error: "Bad Request",
        message: "O curso deve ter pelo menos uma aula para ser publicado.",
      });
    }

    const curso = await prisma.curso.update({
      where: { id },
      data: { status: "PUBLICADO" },
    });

    return res.status(200).send({
      id: curso.id,
      titulo: curso.titulo,
      status: curso.status,
      message: "Curso publicado com sucesso",
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao publicar curso.",
    });
  }
};
