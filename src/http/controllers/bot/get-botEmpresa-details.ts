// src/controllers/get-bot-details-controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { GetBotEmpresaDetailsUseCase } from "@/use-cases/get-botEmpresa-details-use-case";

export async function getBotEmpresaDetailsController(req: FastifyRequest, res: FastifyReply) {

const paramsSchema = z.object({
  botId: z.string().uuid(), // Alterado para coincidir com a rota
});

const { botId } = paramsSchema.parse(req.params);


const getBotDetailsUseCase = new GetBotEmpresaDetailsUseCase();

try {
  const botDetails = await getBotDetailsUseCase.execute({
    botEmpresaId: botId, // Passa o botId extraído
  });
  return res.status(200).send(botDetails);
} catch (err: any) {
  return res.status(404).send({ message: err.message });
}
}