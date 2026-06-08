// src/controllers/what-bot-can-not-do.controller.ts
import { addWhatBotCanNotDoSchema, AddWhatBotCanNotDoUseCase } from "@/use-cases/canotDo.usecase";
import { FastifyRequest, FastifyReply } from "fastify";

export async function AddWhatBotCanNotDoController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = addWhatBotCanNotDoSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      error: "Dados inválidos.",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const useCase = new AddWhatBotCanNotDoUseCase();
    const result  = await useCase.execute(parsed.data);
    return reply.status(201).send(result);
  } catch (error: any) {
    return reply.status(400).send({ error: error.message ?? "Erro ao adicionar limitação." });
  }
}