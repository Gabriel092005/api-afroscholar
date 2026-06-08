import { FetchUserSubscriptionsUseCase } from "@/use-cases/feth-subscription";
import { FastifyReply, FastifyRequest } from "fastify";


export async function fetchSubscriptions(request: FastifyRequest, reply: FastifyReply) {
  const usuarioId = request.user.sub;

  try {
    const useCase = new FetchUserSubscriptionsUseCase();
    const assinaturas = await useCase.execute(usuarioId);

    return reply.status(200).send(assinaturas);
  } catch (err: any) {
    return reply.status(400).send({ message: "Não foi possível carregar as assinaturas." });
  }
}