    
import { FastifyRequest, FastifyReply } from "fastify";
import { addWhatBotCanDoSchema, AddWhatBotCanDoUseCase } from "@/use-cases/add-what-bot-can-do.usecase";

export async function AddWhatBotCanDoController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = addWhatBotCanDoSchema.safeParse(request.body);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Erros de validação:', parsed.error.flatten().fieldErrors);
    }
  }

  if (!parsed.success) {
    return reply.status(400).send({
      error: "Dados inválidos.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const useCase = new AddWhatBotCanDoUseCase();
    const result  = await useCase.execute(parsed.data);
    return reply.status(201).send(result);
  } catch (error: any) {
    return reply.status(400).send({ error: error.message ?? "Erro ao adicionar competência." });
  }
}