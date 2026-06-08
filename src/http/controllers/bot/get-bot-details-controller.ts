import { FastifyReply, FastifyRequest } from "fastify";
import { GetBotDetailsUseCase } from "@/use-cases/get-bot-details-use-case";
import { z } from "zod";

export async function GetBotDetailsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Validação do parâmetro ID
    const getBotParamsSchema = z.object({
      id: z.string().uuid(),
    });

    const { id } = getBotParamsSchema.parse(request.params);

    const getBotDetailsUseCase = new GetBotDetailsUseCase();
    const { bot } = await getBotDetailsUseCase.execute({ botId: id });

    if (!bot) {
      return reply.status(404).send({ message: "Bot não encontrado." });
    }

    return reply.status(200).send(bot);

  } catch (err) {
    console.error(err);

    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Erro de validação",
        issues: err.format(),
      });
    }

    return reply.status(500).send({
      message: "Erro interno",
      error: err instanceof Error ? err.message : err,
    });
  }
}