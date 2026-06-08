import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const criarSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  descricao: z.string().optional(),
  imagem: z.string().optional(),
  bolsaId: z.string().uuid().optional(),
});

export async function criar(req: FastifyRequest, res: FastifyReply) {
  try {
    const { sub: usuarioId } = req.user;
    const body = criarSchema.parse(req.body);

    const comunidade = await prisma.community.create({
      data: {
        nome: body.nome,
        descricao: body.descricao,
        imagem: body.imagem,
        criadorId: usuarioId,
        bolsaId: body.bolsaId,
        membros: {
          create: {
            usuarioId,
            role: "ADMIN",
          },
        },
      },
      include: {
        _count: { select: { membros: true, mensagens: true } },
        membros: {
          where: { usuarioId },
          select: { role: true },
        },
        criador: {
          select: { id: true, nome: true, image_path: true },
        },
        bolsa: {
          select: { id: true, titulo: true },
        },
      },
    });

    return res.status(201).send({
      ...comunidade,
      souMembro: true,
      meuPapel: comunidade.membros[0]?.role || null,
      membros: undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao criar comunidade." });
  }
}
