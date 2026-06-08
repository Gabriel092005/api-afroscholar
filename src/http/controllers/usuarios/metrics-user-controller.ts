import { GetUserMetricsUseCase } from "@/use-cases/GetUserMetricsUseCase";
import { FastifyReply, FastifyRequest } from "fastify";

export async function getUserMetricsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const usuarioId = request.user.sub; 

    const getUserMetricsUseCase = new GetUserMetricsUseCase();
    const { metrics } = await getUserMetricsUseCase.execute({ usuarioId });

    return reply.status(200).send(metrics);
  } catch (err) {
    return reply.status(500).send({ message: "Erro ao buscar métricas do dashboard." });
  }
}