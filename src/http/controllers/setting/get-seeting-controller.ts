
import { FastifyRequest, FastifyReply } from "fastify";
import { getSettingsUseCase } from "@/use-cases/get-express-message-use-case";

export async function getExpressMessageController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = await getSettingsUseCase();
    
    return reply.status(200).send(data);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: "Erro ao buscar configuração." });
  }
}