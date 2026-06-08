import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";

interface QueryParams {
  search?: string;
  categoria?: string;
  nivel?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export const listCursos = async (
  req: FastifyRequest<{ Querystring: QueryParams }>,
  res: FastifyReply
) => {
  try {
    const { search, categoria, nivel, status, page = "1", limit = "10" } = req.query;

    const where: any = {};

    if (status) {
      where.status = status === "PUBLICADO" ? "PUBLICADO" : "RASCUNHO";
    }

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: "insensitive" } },
        { categoria: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoria) where.categoria = categoria;
    if (nivel) where.nivel = nivel;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cursos, total] = await Promise.all([
      prisma.curso.findMany({
        where,
        include: {
          aulas: {
            orderBy: { ordem: "asc" },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.curso.count({ where }),
    ]);

    const data = cursos.map((curso) => ({
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
    }));

    return res.send({
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({
      error: "Internal Server Error",
      message: "Erro ao listar cursos.",
    });
  }
};
