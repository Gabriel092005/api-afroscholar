import { env } from "@/Env";
import { liberarCursoParaMentorados } from "@/lib/mentoria-acesso";
import { erroAoVincularBolsa, erroNoPrecoDoCurso } from "@/lib/curso-bolsa";
import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

function avatarDoUtilizador(imagePath: string | null) {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${env.API_URL}/uploads/${imagePath}`;
}

const createCursoSchema = z.object({
  titulo: z.string().min(1),
  subtitulo: z.string().optional(),
  categoria: z.string().optional(),
  nivel: z.string().optional(),
  duracao: z.string().optional(),
  preco: z.number().optional(),
  idioma: z.string().optional(),
  tags: z.array(z.string()).optional(),
  descricao: z.string().optional(),
  capaUrl: z.string().optional(),
  status: z.enum(["RASCUNHO", "PUBLICADO"]).optional(),
  // Opcional: null/ausente indica um curso independente, vendido à parte.
  bolsaId: z.string().min(1).nullable().optional(),
});

export const createCurso = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const body = createCursoSchema.parse(req.body);

    const autor = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { nome: true, image_path: true },
    });
    if (!autor) {
      return res.status(401).send({ error: "Unauthorized", message: "Sessão inválida." });
    }

    if (body.bolsaId) {
      const erro = await erroAoVincularBolsa(body.bolsaId, req.user.sub);
      if (erro) return res.status(erro.status).send({ error: "Bad Request", message: erro.message });
    } else {
      const erroPreco = erroNoPrecoDoCurso(body.preco);
      if (erroPreco) return res.status(400).send({ error: "Bad Request", message: erroPreco });
    }

    const curso = await prisma.curso.create({
      data: {
        titulo: body.titulo,
        subtitulo: body.subtitulo,
        categoria: body.categoria,
        nivel: body.nivel,
        duracao: body.duracao,
        // O acesso a um curso de bolsa vem da inscrição na bolsa, não de uma compra à parte.
        preco: body.bolsaId ? 0 : body.preco ?? 0,
        idioma: body.idioma,
        tags: body.tags || [],
        descricao: body.descricao,
        capaUrl: body.capaUrl,
        status: body.status || "RASCUNHO",
        mentorNome: autor.nome,
        mentorAvatar: avatarDoUtilizador(autor.image_path),
        bolsaId: body.bolsaId ?? null,
        criadoPorId: req.user?.sub,
      },
    });

    if (body.bolsaId) await liberarCursoParaMentorados(curso.id, body.bolsaId);

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
