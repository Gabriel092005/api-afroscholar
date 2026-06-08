import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

import { z } from "zod";

const addAulaSchema = z.object({
  titulo: z.string().min(1),
  tipo: z.enum(["VIDEO", "PDF", "QUIZ"]).optional(),
  duracao: z.string().optional(),
  gratuito: z.boolean().optional(),
  videoUrl: z.string().optional(),
  videoLocal: z.string().optional(),
  pdfUrl: z.string().optional(),
});

export const addAula = async (
  req: FastifyRequest<{ Params: { cursoId: string } }>,
  res: FastifyReply
) => {
  try {
    const { cursoId } = req.params;
    const body = addAulaSchema.parse(req.body);

    const existingCurso = await prisma.curso.findUnique({
      where: { id: cursoId },
      include: { aulas: true },
    });

    if (!existingCurso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    const maxOrdem = existingCurso.aulas.reduce(
      (max, a) => Math.max(max, a.ordem),
      0
    );

    const aula = await prisma.aula.create({
      data: {
        titulo: body.titulo,
        tipo: body.tipo || "VIDEO",
        duracao: body.duracao,
        ordem: maxOrdem + 1,
        gratuito: body.gratuito || false,
        videoUrl: body.videoUrl,
        videoLocal: body.videoLocal,
        pdfUrl: body.pdfUrl,
        cursoId,
      },
    });

    await prisma.curso.update({
      where: { id: cursoId },
      data: { quantAulas: existingCurso.aulas.length + 1 },
    });

    return res.status(201).send({
      id: aula.id,
      titulo: aula.titulo,
      message: "Aula adicionada com sucesso",
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
      message: "Erro ao adicionar aula.",
    });
  }
};
