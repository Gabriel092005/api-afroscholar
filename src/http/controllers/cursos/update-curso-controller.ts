import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const updateCursoSchema = z.object({
  titulo: z.string().min(1).optional(),
  subtitulo: z.string().optional(),
  categoria: z.string().optional(),
  nivel: z.string().optional(),
  duracao: z.string().optional(),
  preco: z.number().optional(),
  precoOriginal: z.number().optional(),
  idioma: z.string().optional(),
  tags: z.array(z.string()).optional(),
  descricao: z.string().optional(),
  capaUrl: z.string().optional(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
  mentorNome: z.string().optional(),
  mentorAvatar: z.string().optional(),
});

export const updateCurso = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  res: FastifyReply
) => {
  try {
    const { id } = req.params;
    const body = updateCursoSchema.parse(req.body);

    const existingCurso = await prisma.curso.findUnique({
      where: { id },
    });

    if (!existingCurso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    const curso = await prisma.curso.update({
      where: { id },
      data: body,
    });

    return res.status(200).send({
      id: curso.id,
      titulo: curso.titulo,
      message: "Curso atualizado com sucesso",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({
        error: "Validation Error",
        issues: error.format(),
      });
    }
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao atualizar curso.",
    });
  }
};
