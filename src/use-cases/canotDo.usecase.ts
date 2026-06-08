// src/use-cases/add-what-bot-can-not-do.usecase.ts
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addWhatBotCanNotDoSchema = z.object({
  botId:       z.string().uuid(),
  title:       z.string().min(3, "Título deve ter pelo menos 3 caracteres."),
  description: z.string().optional(),
});

type AddWhatBotCanNotDoInput = z.infer<typeof addWhatBotCanNotDoSchema>;

export class AddWhatBotCanNotDoUseCase {
  async execute({ botId, title, description }: AddWhatBotCanNotDoInput) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new Error("Bot não encontrado.");

    return await prisma.whatBotCanNotDo.create({
      data: { botId, title, description },
    });
  }
}