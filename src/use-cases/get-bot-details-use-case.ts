import { Bot } from "@/generated/client";
import { prisma } from "@/lib/prisma"; // Ou onde seu prisma está instanciado


interface GetBotDetailsUseCaseRequest {
  botId: string;
}

interface GetBotDetailsUseCaseResponse {
  bot: Bot | null;
}

export class GetBotDetailsUseCase {
  async execute({
    botId,
  }: GetBotDetailsUseCaseRequest): Promise<GetBotDetailsUseCaseResponse> {
    const bot = await prisma.bot.findUnique({
      where: {
        id: botId,
      },
      include: {
        assets: true, // Traz imagens, ícones, etc.
        _count: {
          select: { contratos: true }, // Traz a quantidade de empresas que o usam
        },
      },
    });

    return {
      bot,
    };
  }
}