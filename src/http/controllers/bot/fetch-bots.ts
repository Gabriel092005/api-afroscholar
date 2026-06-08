// create-bot-controller.ts
import { upload } from "@/lib/upload";
import { CreateBotUseCase } from "@/use-cases/create-bot-use-case";
import { FastifyReply, FastifyRequest } from "fastify";
import { createBotSchema } from "./create-bot-type";
import fs from "node:fs";
import { FetchBotUseCase } from "@/use-cases/fetch-bots";

export async function FetchBotController(request: FastifyRequest, reply: FastifyReply) {
  try {

    const BotUseCase = new FetchBotUseCase();
    const {bots } = await BotUseCase.execute();

    return reply.status(201).send(bots);

  } catch (err) {
    console.error(err);

   

    return reply.status(500).send({
      message: "Erro interno",
      error: err instanceof Error ? err.message : err,
    });
  }
}