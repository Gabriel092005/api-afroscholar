import { prisma } from "@/lib/prisma";

export class ListBotCapabilitiesUseCase {
  async execute(botId: string) {

    const [canDo, canNotDo] = await Promise.all([
      prisma.whatBotCanDo.findMany({
        where: { botId },
        orderBy: { title: 'asc' }
      }),
      prisma.whatBotCanNotDo.findMany({
        where: { botId },
        orderBy: { title: 'asc' }
      })
    ]);

    return {
      canDo,
      canNotDo
    };
  }
}