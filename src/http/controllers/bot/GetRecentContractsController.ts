// src/modules/bots/controllers/get-my-bots.ts
import { GetMyBotsUseCase } from "@/use-cases/GetRecentContractsUseCase";
import { FastifyRequest, FastifyReply } from "fastify";


export async function getMyBotsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Idealmente vindo do token JWT (request.user.id)
  const userId  = request.user.sub

  if (!userId) {
    return reply.status(400).send({ message: "O ID do usuário é obrigatório." });
  }

  const getMyBotsUseCase = new GetMyBotsUseCase();

  try {
    const bots = await getMyBotsUseCase.execute({ usuarioId: userId });
    
    return reply.status(200).send(bots);
  } catch (error) {
    return reply.status(500).send({ 
      message: "Erro ao carregar sua lista de bots contratados." 
    });
  }
}