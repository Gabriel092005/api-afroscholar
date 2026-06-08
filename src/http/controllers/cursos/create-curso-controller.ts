import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const createCursoSchema = z.object({
  titulo: z.string().min(1),
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

export const createCurso = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const body = createCursoSchema.parse(req.body);

    const curso = await prisma.curso.create({
      data: {
        titulo: body.titulo,
        subtitulo: body.subtitulo,
        categoria: body.categoria,
        nivel: body.nivel,
        duracao: body.duracao,
        preco: body.preco || 0,
        precoOriginal: body.precoOriginal,
        idioma: body.idioma,
        tags: body.tags || [],
        descricao: body.descricao,
        capaUrl: body.capaUrl,
        status: body.status || "RASCUNHO",
        mentorNome: body.mentorNome,
        mentorAvatar: body.mentorAvatar,
      },
    });

    return res.status(201).send({
      id: curso.id,
      titulo: curso.titulo,
      message: "Curso criado com sucesso",
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
      message: "Erro ao criar curso.",
    });
  }
};
