import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const createMentoriaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  bolsaId: z.string().uuid().optional(),
  preco: z
    .number()
    .refine((v) => v === 0 || v >= 100, "O preço deve ser 0 (gratuito) ou pelo menos 100 Kz")
    .optional(),
});

export async function createMentoria(req: FastifyRequest, res: FastifyReply) {
  try {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem criar mentorias." });
    }

    const body = createMentoriaSchema.parse(req.body);

    const mentoria = await prisma.mentoria.create({
      data: {
        nome: body.nome,
        descricao: body.descricao,
        bolsaId: body.bolsaId,
        preco: body.preco,
      },
    });

    return res.status(201).send(mentoria);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao criar mentoria." });
  }
}
