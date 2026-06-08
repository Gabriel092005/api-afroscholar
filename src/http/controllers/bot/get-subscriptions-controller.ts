import { GetSubscriptionsUseCase } from '@/use-cases/list-user-subscriptions-use-case';
import { FastifyRequest, FastifyReply } from 'fastify';




export async function getSubscriptionsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const usuarioId = request.user.sub;

    const getSubscriptionsUseCase = new GetSubscriptionsUseCase();
    const subscriptions = await getSubscriptionsUseCase.execute({ usuarioId });

    return reply.status(200).send(subscriptions);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ 
      message: 'Erro ao carregar histórico de pagamentos.' 
    });
  }
}