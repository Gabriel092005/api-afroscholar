// src/controllers/feedback-controller.ts
import { createFeedbackUseCase, listFeedbacksByBotUseCase } from "@/use-cases/feedback-use-case";
import { z } from 'zod';
import { FastifyRequest, FastifyReply } from "fastify";


export async function   createFeedbackController(request: FastifyRequest, reply: FastifyReply) {
  try {

 const createFeedbackSchema = z.object({
  rating: z.number().min(1).max(5), // Nota de 1 a 5 estrelas
  comentario: z.string().min(3, "O comentário é muito curto").max(500),
  nome_exibicao: z.string().min(2, "Nome é obrigatório"),
  cargo_exibicao: z.string().min(2, "Cargo é obrigatório"),
  botId: z.string().uuid("ID do Bot inválido"),
});

  const { botId, cargo_exibicao, comentario, nome_exibicao, rating} = createFeedbackSchema.parse(request.body)
  const userId = request.user.sub
    const feedback = await createFeedbackUseCase({
      rating,
      comentario,
      nome_exibicao,
      cargo_exibicao,
      usuarioId:userId,
      botId
    });

    return reply.status(201).send(feedback);
  } catch (error:any) {
    request.log.error(error);
    return error
    return reply.status(400).send({ error: "Erro ao processar feedback" });
  }
}

export async function listFeedbacksController(request: FastifyRequest, reply: FastifyReply) {


 const listFeedbackParamsSchema = z.object({
  botId: z.string().uuid("O ID do Bot fornecido é inválido"),
});
const { botId } = listFeedbackParamsSchema.parse(request.params);
  try {
    const feedbacks = await listFeedbacksByBotUseCase(botId);
    return reply.send(feedbacks);
  } catch (error) {
    return reply.status(404).send({ error: "Feedbacks não encontrados" });
  }
}