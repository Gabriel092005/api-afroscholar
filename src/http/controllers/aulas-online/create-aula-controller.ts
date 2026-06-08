import prisma from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";

const createAulaSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data: z.string().refine((v) => !isNaN(Date.parse(v)), "Data inválida"),
  duracao: z.number().int().positive().optional(),
  bolsaId: z.string().uuid("Bolsa inválida").optional(),
});

export async function createAula(req: FastifyRequest, res: FastifyReply) {
  try {
    const userId = req.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).send({ error: "Forbidden", message: "Apenas administradores podem criar aulas." });
    }

    const body = createAulaSchema.parse(req.body);
    const hostId = req.user.sub;

    const roomId = crypto.randomUUID();

    const aula = await prisma.aulaOnline.create({
      data: {
        titulo: body.titulo,
        descricao: body.descricao,
        data: new Date(body.data),
        duracao: body.duracao,
        roomId,
        hostId,
        bolsaId: body.bolsaId,
      },
    });

    return res.status(201).send(aula);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao criar aula." });
  }
}
