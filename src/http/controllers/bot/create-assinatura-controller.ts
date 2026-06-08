import { SubscriptionUseCase } from "@/use-cases/create-subscription-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const useCase = new SubscriptionUseCase();
const checkoutBodySchema = z.object({
  itens: z
    .array(
      z.object({
        botId:          z.string().uuid(),
        empresaId:      z.string().uuid(),
        departamentoId: z.string().uuid(),
        quantity:       z.number().int().min(1),
      })
    )
    .min(1, "Envie pelo menos um item."),
});


export async function checkoutController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = checkoutBodySchema.safeParse(request.body);

  if (!parsed.success) {
    request.log.warn(
      { errors: parsed.error.flatten().fieldErrors },
      "[checkout] Body inválido"
    );
    return reply.status(400).send({
      error:   "Dados inválidos.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  // try {
//     const result = await useCase.checkout(request.user.sub, parsed.data.itens);
//     request.log.info(
//       { usuarioId: request.user.sub, quantidade: result.quantidade },
//       "[checkout] Assinaturas criadas"
//     );
//     return reply.status(201).send(result);
//   } catch (error) {
//     request.log.error({ err: error, usuarioId: request.user.sub }, "[checkout] Erro");
//     return reply.status(400).send({
//       error: error instanceof Error ? error.message : "Erro interno.",
//     });
//   }
// }

/**
 * GET /subscriptions/pending
 * Retorna assinaturas PENDENTE do usuário logado (usado pelo PaymentDialog).
 */
// export async function getPendingController(
//   request: FastifyRequest,
//   reply: FastifyReply
// ) {
//   try {
//     const result = await useCase.getPending(request.user.sub);
//     request.log.info(
//       { usuarioId: request.user.sub, quantidade: result.resumo.quantidade },
//       "[getPending] Retornadas"
//     );
//     return reply.status(200).send(result);
//   } catch (error) {
//     request.log.error({ err: error, usuarioId: request.user.sub }, "[getPending] Erro");
//     return reply.status(500).send({ error: "Erro interno ao buscar assinaturas." });
//   }
// }

  }