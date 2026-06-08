// src/controllers/payroll-controller.ts
import { GetPayrollSummaryUseCase } from "@/use-cases/admin-payrollRequest";
import { FastifyRequest, FastifyReply } from "fastify";

export async function getPayroll(request: FastifyRequest, reply: FastifyReply) {
  const { mes, ano } = request.query as { mes?: string; ano?: string };
  const usuarioId = request.user.sub;

  const date = new Date();
  
  // Se não houver 'mes' ou 'ano' na query, usa o atual
  const mesAtual = mes ? parseInt(mes) : date.getMonth() + 1;
  const anoAtual = ano ? parseInt(ano) : date.getFullYear();

  const useCase = new GetPayrollSummaryUseCase();

  try {
    const data = await useCase.execute({
      usuarioId,
      mes: mesAtual,
      ano: anoAtual
    });

    return reply.status(200).send(data);
  } catch (error) {
    console.error(error);
    return reply.status(400).send({ message: "Erro ao buscar folha salarial." });
  }
}