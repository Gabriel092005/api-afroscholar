import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const criarRespostaSchema = z.object({
  conteudo: z.string().min(1, "Conteúdo é obrigatório"),
});

export async function criarResposta(req: FastifyRequest, res: FastifyReply) {
  try {
    const { id, duvidaId } = req.params as { id: string; duvidaId: string };
    const { sub: usuarioId } = req.user;
    const body = criarRespostaSchema.parse(req.body);

    const [usuario, duvida] = await Promise.all([
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { role: true },
      }),
      prisma.communityQuestion.findUnique({
        where: { id: duvidaId },
      }),
    ]);

    if (!usuario || (usuario.role !== "ADMIN" && usuario.role !== "GESTOR")) {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores e gestores podem responder dúvidas." });
    }

    if (!duvida || duvida.comunidadeId !== id) {
      return res.status(404).send({ error: "Not Found", message: "Dúvida não encontrada." });
    }

    const resposta = await prisma.communityAnswer.create({
      data: {
        conteudo: body.conteudo,
        duvidaId,
        usuarioId,
      },
      include: {
        usuario: {
          select: { id: true, nome: true, image_path: true },
        },
      },
    });

    return res.status(201).send(resposta);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao responder dúvida." });
  }
}
