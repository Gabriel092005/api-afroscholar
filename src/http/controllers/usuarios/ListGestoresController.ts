import { ListGestoresWithMetricsUseCase } from "@/use-cases/ListGestoresWithMetricsUseCase";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listGestoresController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const listUseCase = new ListGestoresWithMetricsUseCase();
    const result = await listUseCase.execute();

    return reply.status(200).send(result);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ message: "Erro ao listar métricas." });
  }
}