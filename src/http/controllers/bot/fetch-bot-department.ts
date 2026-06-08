import { BuscarBotsDepartamentoUseCase } from '@/use-cases/fetch-bot-in-department';
import { FastifyRequest, FastifyReply } from 'fastify';
import z from 'zod';

export async function BuscarBotsController(request: FastifyRequest, reply: FastifyReply) {
   const paramsSchema = z.object({
    departmentId: z.string().uuid({ message: "O ID do departamento deve ser um UUID válido." }),
  });

  // 2. Validamos os parâmetros da requisição
  const { departmentId} = paramsSchema.parse(request.params);

    const useCase = new BuscarBotsDepartamentoUseCase();

    try {
      const bots = await useCase.execute(departmentId);
      return reply.status(200).send(bots);
    } catch (error: any) {
      return reply.status(400).send({ error: "Erro ao listar bots do departamento." });
    }
  }
