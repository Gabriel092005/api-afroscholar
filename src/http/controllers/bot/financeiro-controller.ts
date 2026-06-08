import { GetFinanceiroRelatoriosUseCase } from "@/use-cases/get-financeiro-relatorios-use-case";
import { FastifyRequest, FastifyReply } from "fastify";


export const FinanceiroController = {
  async getRelatorios(request: FastifyRequest, reply: FastifyReply) {


    try {
      const useCase = new GetFinanceiroRelatoriosUseCase();
      const data = await useCase.execute();

      return reply.status(200).send(data);
    } catch (error) {
      request.server.log.error(error);
      return reply.status(500).send({ 
        error: "Erro ao processar relatórios financeiros." 
      });
    }
  }
};