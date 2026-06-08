import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const criarDuvidaSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  conteudo: z.string().min(1, "Conteúdo é obrigatório"),
});

export async function criarDuvida(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id } = req.params as { id: string };
    const { sub: usuarioId } = req.user;
    const body = criarDuvidaSchema.parse(req.body);

    const membro = await prisma.communityMember.findUnique({
      where: { comunidadeId_usuarioId: { comunidadeId: id, usuarioId } },
    });

    if (!membro) {
      return res.status(403).send({ error: "Forbidden", message: "Não é membro desta comunidade." });
    }

    const duvida = await prisma.communityQuestion.create({
      data: {
        titulo: body.titulo,
        conteudo: body.conteudo,
        comunidadeId: id,
        usuarioId,
      },
      include: {
        usuario: {
          select: { id: true, nome: true, image_path: true },
        },
      },
    });

    return res.status(201).send(duvida);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao criar dúvida." });
  }
}
