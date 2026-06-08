import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ListBotCapabilitiesUseCase } from "@/use-cases/list-bot-capabilities.usecase";

export async function GetBotCapabilitiesController(request: FastifyRequest, reply: FastifyReply) {
  const getParamsSchema = z.object({
    botId: z.string().uuid(),
  });

  const { botId } = getParamsSchema.parse(request.params);

  try {
    const useCase = new ListBotCapabilitiesUseCase();
    const { canDo, canNotDo } = await useCase.execute(botId);

    return reply.status(200).send({
      canDo,
      canNotDo
    });
  } catch (error: any) {
    return reply.status(500).send({ error: "Erro ao listar capacidades do bot." });
  }
}