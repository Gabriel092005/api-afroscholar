// src/use-cases/add-what-bot-can-do.usecase.ts
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addWhatBotCanDoSchema = z.object({
  botId:       z.string().uuid(),
  title:       z.string().min(3, "Título deve ter pelo menos 3 caracteres."),
  description: z.string().optional(),
});

type AddWhatBotCanDoInput = z.infer<typeof addWhatBotCanDoSchema>;

export class AddWhatBotCanDoUseCase {
  async execute({ botId, title, description }: AddWhatBotCanDoInput) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new Error("Bot não encontrado.");

    return await prisma.whatBotCanDo.create({
      data: { botId, title, description },
    });
  }
}