
import { ConfirmPaymentUseCase } from '@/use-cases/confirm-payment-usecase';
import { GetPendingSubscriptionsUseCase } from '@/use-cases/GetPendingSubscriptionsUseCase';
import { FastifyRequest, FastifyReply }   from 'fastify';
import { z } from 'zod';

const confirmBodySchema = z.object({
  iban:          z.string().min(15, "IBAN inválido."),
  assinaturaIds: z.array(z.string().uuid()).min(1, "Envie pelo menos uma assinatura."),
});

// GET /subscriptions/pending
export async function GetPendingSubscriptionsController(
  request: FastifyRequest,
  reply:   FastifyReply
) {
  try {
    const result = await new GetPendingSubscriptionsUseCase()
      .execute({ usuarioId: request.user.sub });
    return reply.send(result);
  } catch (error: any) {
    return reply.status(400).send({ error: error.message });
  }
}

// POST /subscriptions/confirm-payment
export async function ConfirmPaymentController(
  request: FastifyRequest,
  reply:   FastifyReply
) {
  const parsed = confirmBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error:   "Dados inválidos.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const result = await new ConfirmPaymentUseCase().execute({
      usuarioId:     request.user.sub,
      iban:          parsed.data.iban,
      assinaturaIds: parsed.data.assinaturaIds,
    });
    return reply.status(200).send(result);
  } catch (error: any) {
    throw error
    return reply.status(400).send({ error: error.message });
  }
}