import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const createDepoimentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  curso: z.string().min(1, "Curso é obrigatório"),
  texto: z.string().min(10, "Depoimento deve ter pelo menos 10 caracteres"),
  rating: z.number().min(1).max(5).default(5),
  imagem: z.string().optional(),
});

export const createDepoimento = async (
  req: FastifyRequest,
  res: FastifyReply
) => {
  try {
    const body = createDepoimentoSchema.parse(req.body);
    const usuarioId = req.user?.sub;

    const depoimento = await prisma.depoimento.create({
      data: {
        nome: body.nome,
        curso: body.curso,
        texto: body.texto,
        rating: body.rating,
        imagem: body.imagem,
        usuarioId,
        status: "RASCUNHO",
      },
    });

    return res.status(201).send({
      message: "Depoimento enviado para aprovação. Será publicado após revisão.",
      depoimento,
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
      message: "Erro ao criar depoimento.",
    });
  }
};
