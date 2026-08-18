import { prisma } from "@/lib/prisma";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const createAtividadeSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data: z.string().refine((v) => !isNaN(Date.parse(v)), "Data inválida"),
  duracaoMinutos: z.number().int().positive().optional(),
  local: z.string().optional(),
  tipo: z.string().optional(),
});

export async function createAtividade(req: FastifyRequest, res: FastifyReply) {
  try {
    const body = createAtividadeSchema.parse(req.body);
    const criadoPorId = req.user.sub;

    const atividade = await prisma.atividade.create({
      data: {
        titulo: body.titulo,
        descricao: body.descricao,
        data: new Date(body.data),
        duracaoMinutos: body.duracaoMinutos,
        local: body.local,
        tipo: body.tipo || "ATIVIDADE",
        criadoPorId,
      },
    });

    return res.status(201).send({ data: atividade });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).send({ error: "Validation Error", issues: error.format() });
    }
    req.log.error(error);
    return res.status(500).send({ error: "Internal Server Error", message: "Erro ao criar atividade." });
  }
}
