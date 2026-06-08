import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

export const getCurso = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  res: FastifyReply
) => {
  try {
    const { id } = req.params;

    const curso = await prisma.curso.findUnique({
      where: { id },
      include: {
        aulas: {
          orderBy: { ordem: "asc" },
        },
      },
    });

    if (!curso) {
      return res.status(404).send({
        error: "Not Found",
        message: "Curso não encontrado.",
      });
    }

    return res.send({
      id: curso.id,
      titulo: curso.titulo,
      subtitulo: curso.subtitulo,
      categoria: curso.categoria,
      nivel: curso.nivel,
      duracao: curso.duracao,
      quantAulas: curso.quantAulas,
      estudantes: curso.estudantes,
      rating: curso.rating,
      preco: curso.preco,
      precoOriginal: curso.precoOriginal,
      idioma: curso.idioma,
      tags: curso.tags,
      descricao: curso.descricao,
      capaUrl: curso.capaUrl,
      status: curso.status,
      mentorNome: curso.mentorNome,
      mentorAvatar: curso.mentorAvatar,
      created_at: curso.created_at,
      updated_at: curso.updated_at,
      aulas: curso.aulas.map((aula) => ({
        id: aula.id,
        titulo: aula.titulo,
        tipo: aula.tipo,
        duracao: aula.duracao,
        ordem: aula.ordem,
        gratuito: aula.gratuito,
        videoUrl: aula.videoUrl,
        videoLocal: aula.videoLocal,
        pdfUrl: aula.pdfUrl,
        created_at: aula.created_at,
      })),
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao buscar curso.",
    });
  }
};
