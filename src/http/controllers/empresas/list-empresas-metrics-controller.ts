// src/http/controllers/empresas/list-empresas-metrics-controller.ts
import { ListEmpresasWithMetricsUseCase } from "@/use-cases/fetch-all-empresas";
import { FastifyReply, FastifyRequest } from "fastify";

export async function listEmpresasMetricsController(
  request: FastifyRequest, 
  reply: FastifyReply
) {
  try {
    const listEmpresasUseCase = new ListEmpresasWithMetricsUseCase();

    const { empresas, metrics } = await listEmpresasUseCase.execute();

    return reply.status(200).send({
      empresas,
      metrics
    });
    
  } catch (err) {
    console.error("Erro ao buscar empresas:", err);

    return reply.status(500).send({ 
      message: "Erro interno ao processar listagem de empresas",
      error: err instanceof Error ? err.message : "Internal Server Error"
    });
  }
}