// contratacao.controller.ts
import { FinalizarContratacaoUseCase } from '@/use-cases/finalizar-contratacao.usecase';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const itemSchema = z.object({
  botId:          z.string().uuid(),
  empresaId:      z.string().uuid(),
  departamentoId: z.string().uuid(),
  quantity:       z.number().int().min(1),
});

const bodySchema = z.object({
  itens: z.array(itemSchema).min(1),
});

export async function ContratacaoController(
  request: FastifyRequest,
  reply:   FastifyReply
) {
  const usuarioId = request.user.sub;
  const parsed    = bodySchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      error:   "Dados inválidos.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await new FinalizarContratacaoUseCase()
      .execute(usuarioId, parsed.data.itens);
    return reply.status(201).send(result);
  } catch (error: any) {
    return reply.status(400).send({ error: error.message });
  }
}