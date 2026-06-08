// import { SubscriptionUseCase } from "@/use-cases/create-subscription-use-case";
// import { FastifyReply, FastifyRequest } from "fastify";
// import z from "zod";

// const confirmBodySchema = z.object({
//   assinaturaIds: z.array(z.string().uuid()).min(1),
// });

// /**
//  * POST /subscriptions/confirm-payment
//  * Chamado pelo PaymentDialog ao clicar em "Pagar Agora".
//  */
// const useCase = new SubscriptionUseCase()
// export async function confirmPaymentController(
//   request: FastifyRequest,
//   reply: FastifyReply
// ) {
//   const parsed = confirmBodySchema.safeParse(request.body);

//   if (!parsed.success) {
//     return reply.status(400).send({
//       error:   "Dados inválidos.",
//       details: parsed.error.flatten().fieldErrors,
//     });
//   }

//   try {
//     const result = await useCase.(
//       request.user.sub,
//       parsed.data.assinaturaIds
//     );
//     request.log.info(
//       { usuarioId: request.user.sub, quantidade: result.quantidade },
//       "[confirmPayment] Pagamento confirmado pelo usuário"
//     );
//     return reply.status(200).send(result);
//   } catch (error) {
//     request.log.error({ err: error }, "[confirmPayment] Erro");
//     return reply.status(400).send({
//       error: error instanceof Error ? error.message : "Erro interno.",
//     });
//   }
// }